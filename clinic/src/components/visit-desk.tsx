import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { yuan, parseYuan } from "@/lib/tcm/money";
import { findChart, maskId, nextSeq, openTicket } from "@/lib/tcm/registry";
import { useClinic } from "@/lib/tcm/store";
import { PAY_METHODS, SEX_OPTIONS, todayDate, type Chart, type PayMethod, type RegKind } from "@/lib/tcm/types";

const inputCls =
  "h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg outline-none focus:ring-2 focus:ring-ring";

export function VisitDesk() {
  const charts = useClinic((s) => s.charts);
  const registrations = useClinic((s) => s.registrations);
  const role = useClinic((s) => s.role);
  const upsertChart = useClinic((s) => s.upsertChart);
  const addRegistration = useClinic((s) => s.addRegistration);
  const patchRegistration = useClinic((s) => s.patchRegistration);
  const callRegistration = useClinic((s) => s.callRegistration);
  const setPatient = useClinic((s) => s.setPatient);
  const regFen = useClinic((s) => s.fees.regFen);

  const [name, setName] = useState("");
  const [sex, setSex] = useState("");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [idNo, setIdNo] = useState("");
  const [allergy, setAllergy] = useState("");
  const [history, setHistory] = useState("");
  const [chronic, setChronic] = useState("");
  const [chartId, setChartId] = useState("");
  const [fee, setFee] = useState(() => yuan(useClinic.getState().fees.regFen));
  const [method, setMethod] = useState<PayMethod>("现金");
  const [appointAt, setAppointAt] = useState("");
  const [msg, setMsg] = useState("");
  const [call, setCall] = useState("");

  const today = todayDate();
  useEffect(() => {
    setFee(yuan(regFen));
  }, [regFen]);
  const queue = registrations
    .filter((r) => r.visitDate === today && r.status !== "已退号")
    .sort((a, b) => a.seq - b.seq);

  function loadChart(chart: Chart, registrationId = "") {
    setChartId(chart.id);
    setName(chart.name);
    setSex(chart.sex);
    setAge(chart.age);
    setPhone(chart.phone);
    setIdNo("");
    setAllergy(chart.allergy);
    setHistory(chart.history);
    setChronic(chart.chronic);
    setPatient({
      chartId: chart.id,
      registrationId,
      name: chart.name,
      sex: chart.sex,
      age: chart.age,
      phone: chart.phone,
      allergy: chart.allergy,
      visitDate: today,
      ref: registrationId,
    });
  }

  function buildChart(): Chart | null {
    if (!name.trim() || phone.replace(/\D/g, "").length < 6) {
      setMsg("请填写姓名，以及至少 6 位手机号");
      return null;
    }
    const matched = findChart(charts, phone, idNo);
    const now = new Date().toISOString();
    if (matched && matched.id !== chartId && chartId) {
      setMsg("手机号或身份证已属于另一份档案，已改为打开那份，避免重复建档");
      loadChart(matched);
      return null;
    }
    const base = matched ?? charts.find((c) => c.id === chartId);
    return {
      id: base?.id ?? `P-${Date.now()}`,
      name: name.trim(),
      sex,
      age: age.trim(),
      phone: phone.trim(),
      idNo: idNo.trim() || base?.idNo || "",
      allergy: allergy.trim(),
      history: history.trim(),
      chronic: chronic.trim(),
      createdAt: base?.createdAt ?? now,
      updatedAt: now,
    };
  }

  function saveOnly() {
    const chart = buildChart();
    if (!chart) return;
    upsertChart(chart);
    loadChart(chart);
    setMsg(charts.some((c) => c.id === chart.id) ? `已更新档案 ${chart.id}` : `已新建档案 ${chart.id}`);
  }

  function matchExisting() {
    const found = findChart(charts, phone, idNo);
    if (!found) {
      setMsg("没有匹配的档案，可新建");
      return;
    }
    loadChart(found);
    setMsg(`已匹配历史档案 ${found.id}，未重复建档`);
  }

  function register(kind: RegKind) {
    const chart = buildChart();
    if (!chart) return;
    upsertChart(chart);
    const existing = openTicket(registrations, chart.id, today);
    if (existing) {
      loadChart(chart, existing.id);
      setMsg(`今日已有挂号 ${existing.id}，序号 ${existing.seq}`);
      return;
    }
    const reg = {
      id: `G-${Date.now()}`,
      chartId: chart.id,
      patientLabel: chart.name,
      seq: nextSeq(registrations, today),
      visitDate: today,
      appointAt: kind === "预约" ? appointAt : "",
      kind,
      feeFen: parseYuan(fee),
      method,
      paid: true,
      status: "候诊" as const,
      createdAt: new Date().toISOString(),
    };
    addRegistration(reg);
    loadChart(chart, reg.id);
    setMsg(`${kind}挂号 ${reg.id}，就诊序号 ${reg.seq}，挂号费 ¥${yuan(reg.feeFen)} 已记入流水`);
  }

  function summon(id: string) {
    const reg = registrations.find((r) => r.id === id);
    const chart = charts.find((c) => c.id === reg?.chartId);
    if (!reg || !chart || reg.status === "已退号") return;
    callRegistration(id);
    loadChart(chart, reg.id);
    setCall(`请 ${reg.seq} 号 ${chart.name} 到诊室`);
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">建档与挂号</h1>
          <p className="mt-1 text-sm text-muted">先建档再就诊。手机号或身份证相同则打开原档案。未建档不能出方、不能结算。</p>
        </div>
        {chartId && <p className="text-sm text-primary">当前档案 {chartId}</p>}
      </div>
      {call && <p className="mt-3 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">{call}</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input className={inputCls} placeholder="姓名" value={name} onChange={(e) => setName(e.target.value)} />
        <select className={inputCls} value={sex} onChange={(e) => setSex(e.target.value)}>
          {SEX_OPTIONS.map((x) => (
            <option key={x || "none"} value={x}>
              {x || "性别未选"}
            </option>
          ))}
        </select>
        <input className={inputCls} inputMode="numeric" placeholder="年龄" value={age} onChange={(e) => setAge(e.target.value)} />
        <input className={inputCls} inputMode="tel" placeholder="手机号" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input
          className={inputCls}
          placeholder="身份证号，仅本机去重，不回显全文"
          value={idNo}
          onChange={(e) => setIdNo(e.target.value)}
        />
        <input className={inputCls} placeholder="药物过敏史，没有可空" value={allergy} onChange={(e) => setAllergy(e.target.value)} />
        <input className={inputCls} placeholder="既往病史" value={history} onChange={(e) => setHistory(e.target.value)} />
        <input className={inputCls} placeholder="慢病记录" value={chronic} onChange={(e) => setChronic(e.target.value)} />
      </div>
      <p className="mt-2 text-xs text-muted">
        身份证保存在这台浏览器，页面和排队只显示尾号{idNo ? ` ${maskId(idNo)}` : ""}。不要在公共电脑填写。
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input className="h-11 w-24 rounded-md border border-border bg-bg px-3 text-sm" value={fee} onChange={(e) => setFee(e.target.value)} />
        <span className="text-sm text-muted">元挂号费</span>
        <select className="h-11 rounded-md border border-border bg-bg px-3 text-sm" value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
          {PAY_METHODS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <input className="h-11 rounded-md border border-border bg-bg px-3 text-sm" type="datetime-local" value={appointAt} onChange={(e) => setAppointAt(e.target.value)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={matchExisting}>
          匹配档案
        </Button>
        <Button type="button" variant="outline" onClick={saveOnly}>
          保存档案
        </Button>
        <Button type="button" onClick={() => register("现场")}>
          现场挂号
        </Button>
        <Button type="button" variant="outline" onClick={() => register("预约")}>
          预约挂号
        </Button>
      </div>
      {msg && <p className="mt-3 text-sm text-muted">{msg}</p>}

      <h2 className="mt-5 text-base font-semibold">今日排队</h2>
      {queue.length === 0 && <p className="mt-2 text-sm text-muted">还没有挂号。</p>}
      <ul className="mt-2 space-y-2">
        {queue.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
            <div>
              <p className="font-medium">
                {r.seq} 号 · {r.patientLabel} · {r.kind} · {r.status === "已完诊" ? "就诊完成" : r.status}
              </p>
              <p className="text-xs text-muted">
                {r.id} · 档案 {r.chartId} · 挂号费 ¥{yuan(r.feeFen)} {r.paid ? "已收" : "未收"}
                {r.appointAt ? ` · 预约 ${r.appointAt.replace("T", " ")}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              {r.status !== "已完诊" && (
                <Button type="button" size="sm" onClick={() => summon(r.id)}>
                  叫号
                </Button>
              )}
              {r.status === "就诊中" && (
                <Button type="button" size="sm" variant="outline" onClick={() => patchRegistration(r.id, { status: "已完诊" })}>
                  完诊
                </Button>
              )}
              {role === "医师" && r.status !== "已完诊" && (
                <Button type="button" size="sm" variant="ghost" onClick={() => patchRegistration(r.id, { status: "已退号" })}>
                  退号
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
