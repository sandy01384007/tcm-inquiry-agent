import type { ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ClinicShell } from "@/components/clinic-shell";
import { Gate } from "@/components/gate";
import { Button } from "@/components/ui/button";
import { eightPrinciples, matchFormulas, canShowModernDose, localExplain } from "@/lib/tcm/engine";
import { mergeFormulas } from "@/lib/tcm/catalog";
import { isEmergencyIntake } from "@/lib/tcm/emergency";
import { explainPattern } from "@/lib/tcm/explain";
import { getDecoction } from "@/lib/tcm/decoction";
import { parseGrams, stockGaps } from "@/lib/tcm/pharmacy";
import { westUnitFen } from "@/lib/tcm/money";
import { matchWestern } from "@/lib/tcm/western";
import { availableWest } from "@/lib/tcm/west-stock";
import { TongueCapture } from "@/components/tongue-capture";
import { VisitDesk } from "@/components/visit-desk";
import {
  ABDOMEN,
  CHEST,
  COLD_HEAT,
  SLEEP,
  STOOL,
  SWEAT,
  THIRST,
  URINE,
} from "@/lib/tcm/options";
import { useClinic } from "@/lib/tcm/store";
import { SEX_OPTIONS, type ConsultRecord, type Match, type WesternHint } from "@/lib/tcm/types";

export const Route = createFileRoute("/")({ component: Home });

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

const selectCls =
  "h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-fg outline-none focus:ring-2 focus:ring-ring";
const inputCls =
  "h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-fg outline-none focus:ring-2 focus:ring-ring";

function DecoctBlock({ id }: { id: string }) {
  const d = getDecoction(id);
  return (
    <div className="mt-4 rounded-xl border border-border p-3">
      <p className="text-sm font-medium">{d.restricted ? "煎煮说明（受限）" : "煎煮说明"}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted">典籍：{d.classic}</p>
      <dl className="mt-2 grid gap-1 text-xs text-muted sm:grid-cols-2">
        <div>火候：{d.fire}</div>
        <div>加水量：{d.water}</div>
        <div className="sm:col-span-2">浸泡：{d.soak}</div>
      </dl>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed">
        {d.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-muted">服法：{d.take}</p>
      <p className="mt-1 text-xs text-primary">{d.note}</p>
    </div>
  );
}

function Home() {
  return (
    <ClinicShell>
      <Gate>
        <Consult />
      </Gate>
    </ClinicShell>
  );
}

function Consult() {
  const intake = useClinic((s) => s.intake);
  const setIntake = useClinic((s) => s.setIntake);
  const resetIntake = useClinic((s) => s.resetIntake);
  const patient = useClinic((s) => s.patient);
  const setPatient = useClinic((s) => s.setPatient);
  const role = useClinic((s) => s.role);
  const saveRecord = useClinic((s) => s.saveRecord);
  const confirmRecord = useClinic((s) => s.confirmRecord);
  const extraFormulas = useClinic((s) => s.extraFormulas);
  const stock = useClinic((s) => s.stock);
  const westStock = useClinic((s) => s.westStock);
  const fees = useClinic((s) => s.fees);
  const westOrders = useClinic((s) => s.westOrders);
  const westRx = useClinic((s) => s.westRx);
  const saveWestRx = useClinic((s) => s.saveWestRx);
  const catalog = mergeFormulas(extraFormulas);
  const setBillDraft = useClinic((s) => s.setBillDraft);
  const setChatOpen = useClinic((s) => s.setChatOpen);
  const navigate = useNavigate();

  const [matches, setMatches] = useState<Match[]>([]);
  const [principles, setPrinciples] = useState<string[]>([]);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [ai, setAi] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [ackRisk, setAckRisk] = useState(false);
  const [western, setWestern] = useState<WesternHint[]>([]);
  const [selected, setSelected] = useState(0);
  const [deskMsg, setDeskMsg] = useState("");
  const filed = Boolean(patient.chartId);

  const emergency = useMemo(
    () => isEmergencyIntake(intake.chief, intake.pain),
    [intake.chief, intake.pain],
  );

  function run() {
    if (!patient.chartId) {
      setDeskMsg("未建档患者不能出方。请先在上方建档并挂号。");
      return;
    }
    if (emergency.length) return;
    const m = matchFormulas(intake, catalog);
    const p = eightPrinciples(intake);
    setMatches(m);
    setPrinciples(p);
    setWestern(matchWestern(intake));
    setConfirmed(false);
    setAckRisk(false);
    setAi("");
    setSelected(0);
    const rec: ConsultRecord = {
      id: `C-${Date.now()}`,
      createdAt: new Date().toISOString(),
      patient: {
        ...patient,
        ref: patient.ref || "未编号",
        visitDate: patient.visitDate,
      },
      intake,
      matches: m,
      eightPrinciples: p,
      confirmed: false,
      note: "",
    };
    saveRecord(rec);
    setRecordId(rec.id);
  }

  async function askAi() {
    setBusy(true);
    const fallback = localExplain(
      intake,
      matches.map((x) => x.formula.name),
      principles,
    );
    try {
      const res = await explainPattern({
        data: { intake, names: matches.map((x) => x.formula.name) },
      });
      setAi(res.ok && res.text ? res.text : fallback + (res.ok ? "" : `（${res.error}）`));
    } catch {
      setAi(fallback);
    }
    setBusy(false);
  }

  const top = matches[selected] ?? matches[0];
  const stockShort = top
    ? stockGaps(
        top.formula.herbs.map((h) => ({ name: h.name, grams: parseGrams(h.modern) })),
        stock,
        3,
      ).filter((g) => g.short)
    : [];
  const blockedStock = stockShort.length > 0;
  const highRisk = top
    ? top.formula.risk === "critical" || top.formula.risk === "high"
    : false;
  const assistantBlocked = role === "助手";
  const showModern =
    !!top &&
    canShowModernDose(intake, top.formula.risk, top.formula.hideModernDose) &&
    confirmed &&
    !assistantBlocked;

  return (
    <div className="space-y-6">
      <VisitDesk />
      {patient.allergy.trim() && (
        <p className="rounded-xl border border-seal bg-seal/10 px-4 py-3 text-sm font-semibold text-seal">
          过敏史：{patient.allergy}。接诊时请核对，勿开相关药物。
        </p>
      )}
      {deskMsg && <p className="text-sm text-seal">{deskMsg}</p>}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h1 className="text-xl font-semibold">辨证采集</h1>
        <p className="mt-1 text-sm text-muted">先填主诉与寒热二便，再生成方证候选。</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="姓名">
            <input
              className={inputCls}
              value={patient.name}
              onChange={(e) => setPatient({ name: e.target.value })}
              placeholder="如 张三"
            />
          </Field>
          <Field label="年龄">
            <input
              className={inputCls}
              inputMode="numeric"
              value={patient.age}
              onChange={(e) => setPatient({ age: e.target.value })}
              placeholder="岁"
            />
          </Field>
          <Field label="性别">
            <select
              className={selectCls}
              value={patient.sex}
              onChange={(e) => setPatient({ sex: e.target.value })}
            >
              {SEX_OPTIONS.map((x) => (
                <option key={x || "none"} value={x}>
                  {x || "未选"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="就诊日期">
            <input
              className={inputCls}
              type="date"
              value={patient.visitDate}
              onChange={(e) => setPatient({ visitDate: e.target.value })}
            />
          </Field>
          <Field label="患者编号">
            <input
              className={inputCls}
              value={patient.ref}
              onChange={(e) => setPatient({ ref: e.target.value })}
              placeholder="P-001"
            />
          </Field>
          <Field label="起病">
            <input
              className={inputCls}
              value={intake.onset}
              onChange={(e) => setIntake({ onset: e.target.value })}
              placeholder="如 3 天"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="主诉">
              <textarea
                className="min-h-24 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-fg outline-none focus:ring-2 focus:ring-ring"
                value={intake.chief}
                onChange={(e) => setIntake({ chief: e.target.value })}
                placeholder="如：恶寒发热无汗、周身酸痛、咳喘"
              />
            </Field>
          </div>
          <Field label="寒热">
            <select
              className={selectCls}
              value={intake.coldHeat}
              onChange={(e) => setIntake({ coldHeat: e.target.value })}
            >
              {COLD_HEAT.map((x) => (
                <option key={x || "none"} value={x}>
                  {x || "未选"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="汗">
            <select
              className={selectCls}
              value={intake.sweat}
              onChange={(e) => setIntake({ sweat: e.target.value })}
            >
              {SWEAT.map((x) => (
                <option key={x || "none"} value={x}>
                  {x || "未选"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="大便">
            <select
              className={selectCls}
              value={intake.stool}
              onChange={(e) => setIntake({ stool: e.target.value })}
            >
              {STOOL.map((x) => (
                <option key={x || "none"} value={x}>
                  {x || "未选"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="小便">
            <select
              className={selectCls}
              value={intake.urine}
              onChange={(e) => setIntake({ urine: e.target.value })}
            >
              {URINE.map((x) => (
                <option key={x || "none"} value={x}>
                  {x || "未选"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="口渴">
            <select
              className={selectCls}
              value={intake.thirst}
              onChange={(e) => setIntake({ thirst: e.target.value })}
            >
              {THIRST.map((x) => (
                <option key={x || "none"} value={x}>
                  {x || "未选"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="睡眠">
            <select
              className={selectCls}
              value={intake.sleep}
              onChange={(e) => setIntake({ sleep: e.target.value })}
            >
              {SLEEP.map((x) => (
                <option key={x || "none"} value={x}>
                  {x || "未选"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="胸胁">
            <select
              className={selectCls}
              value={intake.chest}
              onChange={(e) => setIntake({ chest: e.target.value })}
            >
              {CHEST.map((x) => (
                <option key={x || "none"} value={x}>
                  {x || "未选"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="腹部">
            <select
              className={selectCls}
              value={intake.abdomen}
              onChange={(e) => setIntake({ abdomen: e.target.value })}
            >
              {ABDOMEN.map((x) => (
                <option key={x || "none"} value={x}>
                  {x || "未选"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="疼痛部位">
            <input
              className={inputCls}
              value={intake.pain}
              onChange={(e) => setIntake({ pain: e.target.value })}
            />
          </Field>
          <Field label="脉象">
            <input
              className={inputCls}
              value={intake.pulse}
              onChange={(e) => setIntake({ pulse: e.target.value })}
              placeholder="如浮紧"
            />
          </Field>
          <TongueCapture
            value={intake.tongue}
            note={intake.tongueAiNote}
            verified={intake.tongueVerified}
            onChange={setIntake}
          />
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={intake.pregnancy}
              onChange={(e) => setIntake({ pregnancy: e.target.checked })}
            />
            妊娠
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={intake.child}
              onChange={(e) => setIntake({ child: e.target.checked })}
            />
            儿童
          </label>
        </div>

        {emergency.length > 0 && (
          <div className="mt-4 rounded-xl border border-primary bg-primary/10 p-4 text-sm">
            <p className="font-semibold text-primary">急症线索：{emergency.join("、")}</p>
            <p className="mt-1 text-muted">请立即按急救流程处理。系统已锁定出方。</p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={run} disabled={emergency.length > 0 || !intake.chief.trim() || !filed}>
            辨证出方
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              resetIntake();
              setMatches([]);
              setConfirmed(false);
              setAi("");
              setWestern([]);
            }}
          >
            清空
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 print:border-0">
        <h2 className="text-lg font-semibold">方证结果</h2>
        {(patient.name || patient.age || patient.visitDate) && (
          <p className="mt-2 text-sm text-muted">
            {[patient.name || "未署名", patient.sex, patient.age ? `${patient.age}岁` : "", patient.visitDate]
              .filter(Boolean)
              .join(" · ")}
            {patient.ref ? ` · 挂号 ${patient.ref}` : ""}
            {patient.chartId ? ` · 档案 ${patient.chartId}` : " · 未建档"}
          </p>
        )}
        {principles.length > 0 && (
          <p className="mt-2 text-sm text-muted">八纲倾向：{principles.join(" · ")}</p>
        )}
        {matches.length === 0 && (
          <p className="mt-6 text-sm text-muted">
            填写主诉后点「辨证出方」。无匹配时请补充寒热汗出与二便。
          </p>
        )}
        <ul className="mt-4 space-y-3">
          {matches.map((m, i) => (
            <li key={m.formula.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(i);
                  setConfirmed(false);
                }}
                className={`w-full rounded-xl border p-3 text-left ${
                  i === selected ? "border-primary bg-secondary" : "border-border"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium">
                    {i === 0 ? "首选 " : "备选 "}
                    {m.formula.name}
                  </p>
                  <span className="text-xs text-muted">
                    {m.formula.channel} · {m.formula.risk}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">{m.formula.pattern}</p>
                <p className="mt-1 text-xs text-muted">
                  依据：{m.reasons.join("、") || "综合"}
                </p>
              </button>
            </li>
          ))}
        </ul>

        {top && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-sm font-medium">
              {top.formula.name} · {top.formula.source}
            </p>
            <p className="mt-1 text-sm text-muted">{top.formula.indication}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {top.formula.herbs.map((h) => (
                <li key={h.name} className="flex justify-between gap-3">
                  <span>{h.name}</span>
                  <span className="text-muted">
                    原方 {h.classic || "—"}
                    {showModern && h.modern ? ` · 草案 ${h.modern}` : ""}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">{top.formula.caution}</p>
            <p className="mt-1 text-xs text-muted">{top.formula.usage}</p>
            {blockedStock && (
              <p className="mt-2 text-sm text-seal">
                库存不足，不能核定、不能收费：{stockShort.map((g) => `${g.name} 需${g.need}g、现${g.have}g`).join("；")}
              </p>
            )}

            <DecoctBlock id={top.formula.id} />

            {western.length > 0 && (
              <div className="mt-4 rounded-xl border border-border bg-secondary/50 p-3">
                <p className="text-sm font-medium">西药协同参考</p>
                <p className="mt-1 text-xs text-muted">
                  仅供有西药处方权的执业医师作对症草稿，不能替代西医诊疗与法定处方。无处方权者不得开具。
                </p>
                <ul className="mt-2 space-y-2">
                  {western.map((w) => (
                    <li key={w.id} className="text-sm">
                      <p className="font-medium">
                        {w.name}
                        <span className="ml-2 text-xs text-muted">{w.cls}</span>
                      </p>
                      <p className="text-xs text-muted">{w.when}</p>
                      {confirmed && !assistantBlocked && w.typical && (
                        <p className="text-xs text-muted">用法线索：{w.typical}</p>
                      )}
                      <p className="text-xs text-primary">{w.caution}</p>
                      <p className="text-xs text-muted">
                        药房可售 {availableWest(westStock, westOrders, w.name)}
                        {westStock.find((item) => item.name === w.name)?.unit ?? "盒"}
                        {availableWest(westStock, westOrders, w.name) < 1 ? "，库存不足不能收费" : ""}
                      </p>
                    </li>
                  ))}
                </ul>
                {!confirmed && (
                  <p className="mt-2 text-xs text-muted">用法须在处方页由医师手写。本系统不开具抗生素、麻醉药品与注射剂。</p>
                )}
                {!assistantBlocked && (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3"
                    disabled={!filed}
                    onClick={() => {
                      const lines = western
                        .filter((w) => w.id !== "oral-rehydration-fever")
                        .map((w) => ({ name: w.name, qty: 1, usage: "" }));
                      if (!lines.length || !patient.chartId) return;
                      saveWestRx({
                        id: `RX-${Date.now()}`,
                        createdAt: new Date().toISOString(),
                        chartId: patient.chartId,
                        registrationId: patient.registrationId,
                        consultId: recordId ?? undefined,
                        patientLabel: [patient.name || "未署名", patient.sex, patient.age ? `${patient.age}岁` : ""].filter(Boolean).join(" "),
                        allergy: patient.allergy,
                        pregnancy: intake.pregnancy,
                        child: intake.child,
                        impression: intake.chief,
                        doctorSign: "",
                        pharmacistSign: "",
                        lines,
                        status: "草稿",
                      });
                      void navigate({ to: "/rx" });
                    }}
                  >
                    开西药处方
                  </Button>
                )}
              </div>
            )}

            {assistantBlocked && (
              <p className="mt-3 rounded-md bg-secondary px-3 py-2 text-sm">
                助手不能核定处方，请转交医师。
              </p>
            )}

            {highRisk && (
              <label className="mt-3 flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={ackRisk}
                  onChange={(e) => setAckRisk(e.target.checked)}
                />
                已知晓本方含高风险药物，剂量须本人面诊后核定，系统不代替决策。
              </label>
            )}

            {!assistantBlocked && (
              <label className="mt-3 flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={(highRisk && !ackRisk) || blockedStock}
                  onChange={(e) => {
                    setConfirmed(e.target.checked);
                    if (e.target.checked && recordId) confirmRecord(recordId);
                  }}
                />
                本人为执业中医师，已结合面诊核定本方草稿。
              </label>
            )}

            <div className="mt-4 flex flex-wrap gap-2 print:hidden">
              <Button variant="secondary" disabled={busy || matches.length === 0} onClick={askAi}>
                {busy ? "解释中…" : "生成辨证说明"}
              </Button>
              <Button
                variant="outline"
                disabled={!confirmed || assistantBlocked}
                onClick={() => window.print()}
              >
                打印草稿
              </Button>
              <Button
                variant="outline"
                disabled={!top || !filed || blockedStock}
                onClick={() => {
                  if (!patient.chartId) {
                    setDeskMsg("未建档患者不能结算。");
                    return;
                  }
                  setBillDraft({
                    consultId: recordId ?? undefined,
                    formulaName: top.formula.name,
                    items: [
                      { name: "挂号费", amountFen: fees.regFen, kind: "挂号" },
                      { name: "诊金", amountFen: fees.consultFen, kind: "诊金" },
                      { name: `中药 ${top.formula.name}`, amountFen: fees.herbFen, kind: "中药" },
                      { name: "代煎", amountFen: fees.decoctFen, kind: "代煎" },
                      ...(westRx.find((rx) => rx.chartId === patient.chartId && rx.status === "已签")?.lines.map((line) => ({
                        name: `西药 ${line.name}`,
                        amountFen: westUnitFen(westStock, line.name) * line.qty,
                        kind: "西药" as const,
                        qty: line.qty,
                      })) ?? []),
                    ],
                  });
                  void navigate({ to: "/billing" });
                }}
              >
                去收费
              </Button>
              <Button variant="ghost" type="button" onClick={() => setChatOpen(true)}>
                问 AI
              </Button>
            </div>
            {ai && <p className="mt-3 text-sm leading-relaxed text-muted">{ai}</p>}
            <p className="mt-4 text-xs text-muted">
              本结果仅供执业中医师参考，不能替代面诊与诊断。涉及真实诊疗须由合格专业人员决定。
            </p>
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
