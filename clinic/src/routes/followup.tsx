import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClinicShell } from "@/components/clinic-shell";
import { Gate } from "@/components/gate";
import { FollowRobot } from "@/components/follow-robot";
import { Button } from "@/components/ui/button";
import type { RobotLine } from "@/lib/tcm/follow-robot";
import { compressTongueFile } from "@/lib/tcm/image";
import { delayLabel, followupsToCsv, hoursPastDue, isDue, keywordHits, recheckDue } from "@/lib/tcm/followup";
import { useClinic } from "@/lib/tcm/store";
import {
  FOLLOW_DELAYS,
  todayDate,
  VISIT_KINDS,
  type FollowCheckin,
  type FollowStatus,
  type FollowTask,
  type MedAdherence,
  type RecheckProgress,
  type SymptomTrend,
  type VisitKind,
} from "@/lib/tcm/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/followup")({ component: FollowupPage });

const TRENDS: SymptomTrend[] = ["好转", "无变化", "加重"];
const MEDS: MedAdherence[] = ["按时服用", "漏服", "停药", "过敏不适"];
const RECHECKS: RecheckProgress[] = ["未做", "已完成"];

const EMPTY_FORM: FollowCheckin = {
  trend: "",
  med: "",
  newDiscomfort: "",
  recheck: "",
  recheckNote: "",
  message: "",
  submittedAt: "",
};

function riskClass(risk: FollowTask["risk"]) {
  if (risk === "高危") return "text-seal";
  if (risk === "关注") return "text-[#8a6414]";
  return "text-primary";
}

function FollowupPage() {
  const role = useClinic((s) => s.role);
  const followups = useClinic((s) => s.followups);
  const config = useClinic((s) => s.followConfig);
  const records = useClinic((s) => s.records);
  const bills = useClinic((s) => s.bills);
  const scheduleFollowup = useClinic((s) => s.scheduleFollowup);
  const submitFollowup = useClinic((s) => s.submitFollowup);
  const patchFollowup = useClinic((s) => s.patchFollowup);
  const setFollowConfig = useClinic((s) => s.setFollowConfig);

  const [pane, setPane] = useState<"患者" | "医护" | "配置">(role === "医师" ? "医护" : "患者");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [robotId, setRobotId] = useState<string | null>(null);
  const [form, setForm] = useState<FollowCheckin>(EMPTY_FORM);
  const [alertHits, setAlertHits] = useState<string[] | null>(null);
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState<"全部" | FollowStatus | FollowTask["risk"]>("全部");
  const [selected, setSelected] = useState<string | null>(null);
  const [manual, setManual] = useState({
    patientLabel: "",
    visitKind: "门诊普通" as VisitKind,
    recheckDate: "",
    recheckItems: "",
  });

  const today = todayDate();
  const active = followups.find((f) => f.id === activeId) ?? null;
  const robotTask = followups.find((f) => f.id === robotId) ?? null;
  const rechecks = followups.filter((t) => recheckDue(t, today));
  const liveHits = keywordHits(`${form.newDiscomfort} ${form.message} ${(form.answers ?? []).join(" ")}`, config.emergencyWords);
  const selectedTask = followups.find((f) => f.id === selected) ?? null;
  const inbox = followups.filter((f) => f.status === "待打卡" && isDue(f));
  const upcoming = followups.filter((f) => f.status === "待打卡" && !isDue(f));
  const history = followups.filter((f) => f.status !== "待打卡");

  const stats = useMemo(() => {
    const done = followups.filter((t) => t.status === "已提交" || t.status === "已回访" || t.status === "已归档").length;
    return {
      total: followups.length,
      rate: followups.length ? Math.round((done / followups.length) * 100) : 0,
      abnormal: followups.filter((t) => t.risk === "高危").length,
      waiting: inbox.length,
    };
  }, [followups, inbox.length]);

  const shown = [...followups]
    .filter((t) => {
      if (filter === "全部") return true;
      return t.status === filter || t.risk === filter;
    })
    .sort((a, b) => rankTask(a) - rankTask(b));

  function onRobotDone(checkin: FollowCheckin, log: RobotLine[]) {
    if (!robotTask) return;
    patchFollowup(robotTask.id, { robotLog: log });
    const result = submitFollowup(robotTask.id, checkin);
    setRobotId(null);
    if (!result) {
      setMsg("这条随访已提交过");
      return;
    }
    if (result.risk === "高危") setAlertHits(result.hits.length ? result.hits : ["症状加重或用药不适"]);
    else setMsg(result.risk === "正常" ? "机器人已归档。到复诊日会提醒复查。" : "机器人已提交，医护会查看。");
  }

  function openCheckin(task: FollowTask) {
    setRobotId(null);
    setActiveId(task.id);
    setForm(EMPTY_FORM);
    setAlertHits(null);
    setMsg("");
    setPane("患者");
  }

  function onSubmit() {
    if (!active) return;
    if (!form.trend || !form.med) {
      setMsg("请选择症状变化和用药情况");
      return;
    }
    const result = submitFollowup(active.id, { ...form, submittedAt: new Date().toISOString() });
    if (!result) {
      setMsg("这条随访已提交过");
      return;
    }
    setActiveId(null);
    setForm(EMPTY_FORM);
    if (result.risk === "高危") {
      setAlertHits(result.hits.length ? result.hits : ["症状加重或用药不适"]);
    } else setMsg(result.risk === "正常" ? "已归档。到复诊日会在本页提醒复查，不能在线调药。" : "已提交。医护会查看这条随访。");
  }

  function onImage(file?: File) {
    if (!file) return;
    void compressTongueFile(file, 640)
      .then((reportImage) => setForm((f) => ({ ...f, reportImage })))
      .catch((e) => setMsg(e instanceof Error ? e.message : "图片无法读取"));
  }

  function exportCsv() {
    const blob = new Blob([followupsToCsv(followups)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "随访记录.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <ClinicShell>
      <Gate>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold">就医随访</h1>
            <p className="mt-1 text-sm text-muted">就诊缴费后跟进病情、用药和复查。只收集信息，不开方、不调药、不诊断。</p>
          </div>
          <div className="flex rounded-full border border-border bg-card p-0.5">
            {(["患者", "医护", "配置"] as const)
              .filter((p) => p !== "配置" || role === "医师")
              .map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPane(p)}
                  className={cn(
                    "min-h-11 rounded-full px-4 text-sm font-semibold",
                    pane === p ? "bg-primary text-primary-foreground" : "text-muted",
                  )}
                >
                  {p === "患者" ? "患者打卡" : p === "医护" ? "医护任务" : "规则配置"}
                </button>
              ))}
          </div>
        </div>

        <p className="mt-4 rounded-2xl border border-border bg-secondary px-4 py-3 text-sm text-fg">
          本随访仅做病情跟进提醒，不能替代执业医师诊疗。图片和症状只留在本机浏览器，供本诊所查看。有急症请立即线下就医。
        </p>

        {pane === "患者" && (
          <div className="mt-6 space-y-4">
            {rechecks.length > 0 && (
              <section className="rounded-2xl border border-primary/40 bg-secondary p-4">
                <h2 className="text-lg font-semibold text-primary">复诊提醒</h2>
                <ul className="mt-2 space-y-2 text-sm">
                  {rechecks.map((t) => (
                    <li key={t.id}>
                      {t.patientLabel} · {t.recheckDate} · {t.recheckItems}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted">请按医师当面交代复诊。这里不能改处方或剂量。</p>
              </section>
            )}
            {inbox.length === 0 && !active && <p className="text-sm text-muted">暂无到期随访。缴费完成后会按规则生成，到点后出现在这里。</p>}
            {inbox.map((t) => (
              <article key={t.id} className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs font-semibold text-primary">随访消息</p>
                <p className="mt-1 font-semibold">{t.patientLabel}</p>
                <p className="mt-1 text-sm text-muted">
                  {t.visitKind} · 请填写症状、用药和复查情况
                  {t.recheckDate ? ` · 复诊 ${t.recheckDate}` : ""}
                </p>
                <p className="mt-1 text-sm">复查项目：{t.recheckItems}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={() => { setActiveId(null); setRobotId(t.id); }}>机器人随访</Button>
                  <Button variant="outline" onClick={() => openCheckin(t)}>
                    表单打卡
                  </Button>
                </div>
              </article>
            ))}

            {robotTask && (
              <FollowRobot
                key={robotTask.id}
                name={robotTask.patientLabel}
                recheckItems={robotTask.recheckItems}
                questions={config.questions ?? []}
                words={config.emergencyWords}
                onDone={onRobotDone}
                onClose={() => {
                  openCheckin(robotTask);
                }}
              />
            )}
            {active && (
              <form
                className="rounded-2xl border border-border bg-card p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  onSubmit();
                }}
              >
                <p className="font-semibold">随访打卡 · {active.patientLabel}</p>
                <p className="mt-1 text-xs text-muted">复诊 {active.recheckDate || "未定"} · {active.recheckItems}</p>
                <fieldset className="mt-4">
                  <legend className="text-sm font-medium">当前症状</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {TRENDS.map((x) => (
                      <Chip key={x} on={form.trend === x} onClick={() => setForm({ ...form, trend: x })}>
                        {x}
                      </Chip>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="mt-4">
                  <legend className="text-sm font-medium">用药情况</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {MEDS.map((x) => (
                      <Chip key={x} on={form.med === x} onClick={() => setForm({ ...form, med: x })}>
                        {x}
                      </Chip>
                    ))}
                  </div>
                </fieldset>
                <label className="mt-4 block text-sm font-medium">
                  有无新增不适
                  <textarea
                    className="mt-2 min-h-16 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm font-normal"
                    value={form.newDiscomfort}
                    onChange={(e) => setForm({ ...form, newDiscomfort: e.target.value })}
                  />
                </label>
                <fieldset className="mt-2">
                  <legend className="text-sm font-medium">复查进度</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {RECHECKS.map((x) => (
                      <Chip key={x} on={form.recheck === x} onClick={() => setForm({ ...form, recheck: x })}>
                        {x}
                      </Chip>
                    ))}
                  </div>
                </fieldset>
                <label className="mt-4 block text-sm">
                  上传复查报告图片（可选，不写入云端）
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="mt-2 block text-sm"
                    onChange={(e) => {
                      onImage(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {form.reportImage && (
                  <img src={form.reportImage} alt="复查报告预览" className="mt-2 h-28 rounded-xl object-cover" />
                )}
                {liveHits.length > 0 && (
                  <p className="mt-3 text-sm font-semibold text-seal">
                    发现急症词：{liveHits.join("、")}。请直接去急诊，不要在这里等回复或自行调药。
                  </p>
                )}
                {(form.trend === "加重" || form.med === "过敏不适") && (
                  <p className="mt-3 text-sm text-seal">提交后会标为高危，供医护回访。本页不能开方或调整药量。</p>
                )}
                {(config.questions ?? []).filter(Boolean).map((q, i) => (
                  <label key={q} className="mt-4 block text-sm font-medium">
                    {q}
                    <input
                      className="mt-2 min-h-11 w-full rounded-xl border border-border bg-bg px-3 text-sm font-normal"
                      value={form.answers?.[i] ?? ""}
                      onChange={(e) => {
                        const answers = [...(form.answers ?? [])];
                        answers[i] = e.target.value;
                        setForm({ ...form, answers });
                      }}
                    />
                  </label>
                ))}
                {config.extraPrompt && <p className="mt-3 text-sm text-muted">医师补充：{config.extraPrompt}</p>}
                <label className="mt-4 block text-sm font-medium">
                  想问医师的话
                  <textarea
                    className="mt-2 min-h-16 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm font-normal"
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                  />
                </label>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="submit">提交打卡</Button>
                  <Button type="button" variant="outline" onClick={() => setActiveId(null)}>
                    取消
                  </Button>
                </div>
              </form>
            )}

            {upcoming.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold">尚未到随访时间</h2>
                <ul className="mt-2 space-y-2">
                  {upcoming.map((t) => (
                    <li key={t.id} className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
                      {t.patientLabel} · {t.visitKind} · {new Date(t.dueAt).toLocaleString()} 后可打卡
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h2 className="text-lg font-semibold">我的随访档案</h2>
              {history.length === 0 && <p className="mt-2 text-sm text-muted">还没有已提交的随访。</p>}
              <ul className="mt-2 space-y-2">
                {history.map((t) => (
                  <li key={t.id} className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
                    <p className="font-medium">
                      {t.patientLabel} · <span className={riskClass(t.risk)}>{t.risk}</span> · {t.status}
                    </p>
                    <p className="mt-1 text-muted">
                      {t.checkin?.trend} · {t.checkin?.med}
                      {t.recheckDate ? ` · 复诊 ${t.recheckDate} ${t.recheckItems}` : ""}
                    </p>
                    {(t.checkin?.answers ?? []).some(Boolean) && (
                      <p className="mt-1 text-muted">补充：{(t.checkin?.answers ?? []).filter(Boolean).join("；")}</p>
                    )}
                    {t.staffNote && <p className="mt-1">医护备注：{t.staffNote}</p>}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        {pane === "医护" && (
          <div className="mt-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="随访完成率" value={`${stats.rate}%`} />
              <Stat label="高危条数" value={String(stats.abnormal)} />
              <Stat label="待打卡" value={String(stats.waiting)} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(["全部", "待打卡", "高危", "关注", "正常", "已回访", "失联归档"] as const).map((f) => (
                <Chip key={f} on={filter === f} onClick={() => setFilter(f)}>
                  {f}
                </Chip>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
                导出 CSV
              </Button>
            </div>

            <form
              className="mt-4 rounded-2xl border border-border bg-card p-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!manual.patientLabel.trim()) {
                  setMsg("请填写患者");
                  return;
                }
                scheduleFollowup(manual);
                setManual({ patientLabel: "", visitKind: "门诊普通", recheckDate: "", recheckItems: "" });
                setMsg("已新增随访任务");
              }}
            >
              <p className="font-semibold">手动新增随访</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input
                  className="min-h-11 rounded-xl border border-border bg-bg px-3 text-sm"
                  placeholder="患者姓名"
                  value={manual.patientLabel}
                  onChange={(e) => setManual({ ...manual, patientLabel: e.target.value })}
                />
                <select
                  className="min-h-11 rounded-xl border border-border bg-bg px-3 text-sm"
                  value={manual.visitKind}
                  onChange={(e) => setManual({ ...manual, visitKind: e.target.value as VisitKind })}
                >
                  {VISIT_KINDS.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
                <input
                  type="date"
                  className="min-h-11 rounded-xl border border-border bg-bg px-3 text-sm"
                  value={manual.recheckDate}
                  onChange={(e) => setManual({ ...manual, recheckDate: e.target.value })}
                />
                <input
                  className="min-h-11 rounded-xl border border-border bg-bg px-3 text-sm"
                  placeholder="复查项目"
                  value={manual.recheckItems}
                  onChange={(e) => setManual({ ...manual, recheckItems: e.target.value })}
                />
              </div>
              <Button className="mt-3" type="submit" size="sm">
                生成任务
              </Button>
            </form>

            <ul className="mt-4 space-y-2">
              {shown.length === 0 && <li className="text-sm text-muted">没有符合筛选的随访。</li>}
              {shown.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(t.id)}
                    className={cn(
                      "w-full rounded-xl border bg-card px-4 py-3 text-left",
                      t.risk === "高危" && t.status !== "失联归档" ? "border-seal" : "border-border",
                    )}
                  >
                    <span className="font-medium">{t.patientLabel}</span>
                    <span className={cn("ml-2 text-sm", riskClass(t.risk))}>{t.risk}</span>
                    <span className="ml-2 text-sm text-muted">
                      {t.status} · {t.visitKind} · {isDue(t) ? "已到点" : "未到点"}
                    </span>
                    {t.status === "待打卡" && hoursPastDue(t) > 48 && (
                      <span className="mt-1 block text-xs text-seal">逾期未打卡，可标记失联</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>

            {selectedTask && (
              <Detail
                key={selectedTask.id}
                task={selectedTask}
                consultChief={records.find((r) => r.id === selectedTask.consultId)?.intake.chief}
                billLabel={bills.find((b) => b.id === selectedTask.billId)?.status}
                onPatch={(patch) => patchFollowup(selectedTask.id, patch)}
                onResend={() => {
                  if (selectedTask.status !== "待打卡") {
                    setMsg("已提交的随访请另新增一条，不能覆盖原答卷");
                    return;
                  }
                  patchFollowup(selectedTask.id, { dueAt: new Date().toISOString() });
                  setMsg("已补发，患者端现在可以打卡");
                }}
              />
            )}
          </div>
        )}

        {pane === "配置" && role === "医师" && (
          <ConfigPane />
        )}

        {msg && <p className="mt-4 text-sm text-muted">{msg}</p>}

        {alertHits && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center">
            <div className="w-full max-w-md rounded-2xl bg-card p-5">
              <p className="text-lg font-extrabold text-seal">请立即线下急诊</p>
              <p className="mt-2 text-sm">
                打卡里出现急症线索{alertHits.length ? `：${alertHits.join("、")}` : ""}。本页不能开方、不能调药、不能给出处置步骤。
              </p>
              <Button className="mt-4 w-full" onClick={() => setAlertHits(null)}>
                我知道了，去线下就医
              </Button>
            </div>
          </div>
        )}
      </Gate>
    </ClinicShell>
  );
}

function rankTask(t: FollowTask) {
  if (t.risk === "高危" && t.status !== "已归档" && t.status !== "失联归档") return 0;
  if (t.status === "待打卡" && isDue(t)) return 1;
  if (t.status === "已提交") return 2;
  return 3;
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full border px-3 text-sm font-semibold",
        on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
      )}
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-primary">{value}</p>
    </div>
  );
}

function Detail({
  task,
  consultChief,
  billLabel,
  onPatch,
  onResend,
}: {
  task: FollowTask;
  consultChief?: string;
  billLabel?: string;
  onPatch: (patch: Partial<FollowTask>) => void;
  onResend: () => void;
}) {
  const [note, setNote] = useState(task.staffNote);
  return (
    <section className="mt-4 rounded-2xl border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">随访详情</h2>
      <p className="mt-1 text-sm text-muted">
        {task.patientLabel} · {task.visitKind} · 到期 {new Date(task.dueAt).toLocaleString()}
      </p>
      <p className="mt-2 text-sm">复诊 {task.recheckDate || "未定"} · {task.recheckItems}</p>
      {consultChief && <p className="mt-2 text-sm">关联病历主诉：{consultChief}</p>}
      {billLabel && <p className="mt-1 text-sm">关联缴费：{billLabel}</p>}
      {task.checkin ? (
        <div className="mt-3 text-sm">
          <p>症状 {task.checkin.trend} · 用药 {task.checkin.med} · 复查 {task.checkin.recheck || "未填"}</p>
          {task.checkin.newDiscomfort && <p className="mt-1">新增不适：{task.checkin.newDiscomfort}</p>}
          {(task.checkin.answers ?? []).some(Boolean) && (
            <p className="mt-1">补充回答：{(task.checkin.answers ?? []).filter(Boolean).join("；")}</p>
          )}
          {task.checkin.message && <p className="mt-1">患者留言：{task.checkin.message}</p>}
          {task.checkin.reportImage && (
            <img src={task.checkin.reportImage} alt="患者上传的复查报告" className="mt-2 max-h-48 rounded-xl" />
          )}
          {(task.robotLog ?? []).length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              <li className="font-medium">机器人对话</li>
              {task.robotLog?.map((line, i) => (
                <li key={i} className="text-muted">
                  {line.role === "robot" ? "机器人" : "患者"}：{line.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">患者尚未打卡。</p>
      )}
      <label className="mt-3 block text-sm">
        回访备注（电话或线上回复后填写，不能写调药）
        <textarea
          className="mt-2 min-h-16 w-full rounded-xl border border-border bg-bg px-3 py-2"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => onPatch({ staffNote: note })}>
          保存备注
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onPatch({ risk: "高危", status: "已提交" })}>
          标为高危
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onPatch({ status: "已回访", staffNote: note })}>
          已回访
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onPatch({ status: "失联归档" })}>
          失联归档
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onResend}>
          补发提醒
        </Button>
      </div>
    </section>
  );
}

function ConfigPane() {
  const config = useClinic((s) => s.followConfig);
  const setFollowConfig = useClinic((s) => s.setFollowConfig);
  const [words, setWords] = useState(config.emergencyWords.join("、"));
  const [prompt, setPrompt] = useState(config.extraPrompt);
  const [questions, setQuestions] = useState<string[]>([config.questions[0] ?? "", config.questions[1] ?? "", config.questions[2] ?? ""]);
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">随访规则</h2>
      <p className="mt-1 text-sm text-muted">不同类型用不同回访时间。新任务才套用新规则。</p>
      <ul className="mt-4 space-y-3">
        {VISIT_KINDS.map((kind) => {
          const hours = config.rules.find((r) => r.kind === kind)?.delayHours ?? 24;
          return (
            <li key={kind} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{kind}</span>
              <select
                className="min-h-11 rounded-full border border-border bg-bg px-3 text-sm"
                value={hours}
                onChange={(e) => {
                  const delayHours = Number(e.target.value);
                  const rules = VISIT_KINDS.map((k) => ({
                    kind: k,
                    delayHours: k === kind ? delayHours : config.rules.find((r) => r.kind === k)?.delayHours ?? 24,
                  }));
                  setFollowConfig({ rules });
                }}
              >
                {FOLLOW_DELAYS.map((h) => (
                  <option key={h} value={h}>
                    {delayLabel(h)}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
      <label className="mt-4 block text-sm">
        自定义问题（最多 3 条，患者打卡时填写）
        {questions.map((q, i) => (
          <input
            key={i}
            className="mt-2 min-h-11 w-full rounded-xl border border-border bg-bg px-3"
            placeholder={`问题 ${i + 1}`}
            value={q}
            onChange={(e) => setQuestions(questions.map((item, idx) => (idx === i ? e.target.value : item)))}
          />
        ))}
      </label>
      <label className="mt-3 block text-sm">
        问卷补充说明
        <textarea
          className="mt-2 min-h-16 w-full rounded-xl border border-border bg-bg px-3 py-2"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </label>
      <label className="mt-3 block text-sm">
        急症关键词（用顿号或逗号分开）
        <textarea
          className="mt-2 min-h-16 w-full rounded-xl border border-border bg-bg px-3 py-2"
          value={words}
          onChange={(e) => setWords(e.target.value)}
        />
      </label>
      <Button
        className="mt-3"
        type="button"
        onClick={() =>
          setFollowConfig({
            extraPrompt: prompt.trim(),
            questions: questions.map((q) => q.trim()).filter(Boolean),
            emergencyWords: words
              .split(/[、,，\s]+/)
              .map((w) => w.trim())
              .filter(Boolean),
          })
        }
      >
        保存配置
      </Button>
    </section>
  );
}
