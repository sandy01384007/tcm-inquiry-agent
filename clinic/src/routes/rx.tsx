import { useState } from "react";
import { flushSync } from "react-dom";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClinicShell } from "@/components/clinic-shell";
import { Gate } from "@/components/gate";
import { Button } from "@/components/ui/button";
import { useClinic } from "@/lib/tcm/store";
import { westUnitFen } from "@/lib/tcm/money";
import { availableWest } from "@/lib/tcm/west-stock";
import { rxBlock } from "@/lib/tcm/west-rx";
import { WESTERN } from "@/lib/tcm/western";
import type { WestRx, WestRxLine, WestStockItem } from "@/lib/tcm/types";

export const Route = createFileRoute("/rx")({ component: RxPage });

const inputCls = "h-11 w-full rounded-md border border-border bg-bg px-3 text-sm";

function RxPage() {
  const navigate = useNavigate();
  const role = useClinic((s) => s.role);
  const patient = useClinic((s) => s.patient);
  const intake = useClinic((s) => s.intake);
  const list = useClinic((s) => s.westRx);
  const stock = useClinic((s) => s.westStock);
  const orders = useClinic((s) => s.westOrders);
  const saveWestRx = useClinic((s) => s.saveWestRx);
  const patchWestRx = useClinic((s) => s.patchWestRx);
  const signWestRx = useClinic((s) => s.signWestRx);
  const markWestPrinted = useClinic((s) => s.markWestPrinted);
  const voidWestRx = useClinic((s) => s.voidWestRx);
  const setBillDraft = useClinic((s) => s.setBillDraft);
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const current = list.find((rx) => rx.id === openId) ?? null;
  const physician = role === "医师";

  function signHint(rx: WestRx) {
    if (!physician) return "当前是助手，不能签署。请把右上角换成医师。";
    const block = rxBlock(rx);
    if (block) return block;
    const short = rx.lines.some((line) => availableWest(stock, orders, line.name) < line.qty);
    return short ? "可以签署。库存不足的药签署后仍不能收费、发药，请先入库。" : "可以签署。打印时姓名按草体输出。";
  }

  function blank(): WestRx {
    return {
      id: `RX-${Date.now()}`,
      createdAt: new Date().toISOString(),
      chartId: patient.chartId,
      registrationId: patient.registrationId,
      patientLabel: [patient.name || "未署名", patient.sex, patient.age ? `${patient.age}岁` : ""].filter(Boolean).join(" "),
      allergy: patient.allergy,
      pregnancy: intake.pregnancy,
      child: intake.child,
      impression: intake.chief,
      doctorSign: "",
      pharmacistSign: "",
      lines: [],
      status: "草稿",
    };
  }

  function addDrug(name: string) {
    const base = current ?? blank();
    if (base.status !== "草稿") return;
    if (base.lines.some((line) => line.name === name)) return;
    const next = { ...base, lines: [...base.lines, { name, qty: 1, usage: "" }] };
    saveWestRx(next);
    setOpenId(next.id);
  }

  function patchLine(rx: WestRx, index: number, patch: Partial<WestRxLine>) {
    patchWestRx(rx.id, { lines: rx.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)) });
  }

  function charge(rx: WestRx) {
    setBillDraft({
      consultId: rx.consultId,
      items: rx.lines.map((line) => ({
        name: `西药 ${line.name}`,
        amountFen: westUnitFen(useClinic.getState().westStock, line.name) * line.qty,
        kind: "西药" as const,
        qty: line.qty,
      })),
    });
    void navigate({ to: "/billing" });
  }

  async function printRx(id: string) {
    const rx = useClinic.getState().westRx.find((item) => item.id === id);
    if (!rx || rx.status === "草稿" || rx.status === "作废") {
      setMsg("请先在程序里签署。草稿和作废处方不打印。");
      return;
    }
    if (!(rx.doctorSign ?? "").trim() || !(rx.pharmacistSign ?? "").trim()) {
      setMsg("请先在程序里打好医师和药师签名，打印才会带上同样的草体姓名。");
      return;
    }
    setOpenId(id);
    try {
      await document.fonts.load("400 32px CaoTi");
      await document.fonts.ready;
    } catch {
      /* 字体未就绪时仍按程序记录打印 */
    }
    flushSync(() => markWestPrinted(id));
    document.documentElement.classList.add("print-rx");
    const clear = () => {
      document.documentElement.classList.remove("print-rx");
      window.removeEventListener("afterprint", clear);
    };
    window.addEventListener("afterprint", clear);
    window.print();
  }

  return (
    <ClinicShell>
      <Gate>
        <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
          <div>
            <h1 className="text-2xl font-extrabold">西药处方</h1>
            <p className="mt-1 text-sm text-muted">只给有西药处方权的医师作草稿。未签署不能收费。不含抗生素、麻醉药品和注射剂，也不是法定电子处方。</p>
          </div>
          <Button
            type="button"
            disabled={!physician || !patient.chartId}
            onClick={() => {
              const rx = blank();
              saveWestRx(rx);
              setOpenId(rx.id);
              setMsg(patient.chartId ? "已为当前患者建草稿" : "");
            }}
          >
            新建草稿
          </Button>
        </div>
        {!patient.chartId && <p className="mt-3 text-sm text-seal print:hidden">当前没有建档患者，不能开处方。</p>}
        {patient.allergy && <p className="mt-3 text-sm text-seal print:hidden">过敏史：{patient.allergy}</p>}
        <div className="mt-3 flex flex-wrap gap-2 print:hidden">
          {WESTERN.filter((drug) => drug.id !== "oral-rehydration-fever").map((drug) => (
            <button key={drug.id} type="button" className="min-h-11 rounded-full border border-border px-3 text-xs" onClick={() => addDrug(drug.name)}>
              {drug.name}
            </button>
          ))}
        </div>
        {msg && <p className="mt-3 text-sm text-muted print:hidden">{msg}</p>}
        <ul className="mt-4 space-y-3 print:hidden">
          {list.length === 0 && <li className="text-sm text-muted">还没有西药处方。</li>}
          {list.map((rx) => (
            <li key={rx.id} className="rounded-2xl border border-border bg-card p-4">
              <button type="button" className="text-left" onClick={() => setOpenId(rx.id)}>
                <p className="font-medium">
                  {rx.patientLabel} · {rx.status}
                </p>
                <p className="text-xs text-muted">
                  {rx.id} · {rx.createdAt.slice(0, 16).replace("T", " ")}
                  {rx.signedAt ? ` · 签署 ${rx.signedAt.slice(0, 16).replace("T", " ")}` : ""}
                  {rx.printedAt ? ` · 已打印 ${rx.printedAt.slice(0, 16).replace("T", " ")}` : ""}
                </p>
              </button>
              {openId === rx.id && (
                <div className="mt-3">
                  <textarea
                    className="min-h-16 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
                    disabled={rx.status !== "草稿"}
                    placeholder="临床印象，由医师填写，系统不自动诊断"
                    value={rx.impression}
                    onChange={(e) => patchWestRx(rx.id, { impression: e.target.value })}
                  />
                  <ul className="mt-2 space-y-2">
                    {rx.lines.map((line, i) => (
                      <li key={line.name} className="grid gap-2 sm:grid-cols-[1fr_5rem_1.4fr]">
                        <p className="text-sm">
                          {line.name}
                          <span className="ml-2 text-xs text-muted">可售 {availableWest(stock, orders, line.name)}</span>
                        </p>
                        <input
                          className={inputCls}
                          type="number"
                          min={1}
                          disabled={rx.status !== "草稿"}
                          value={line.qty}
                          onChange={(e) => patchLine(rx, i, { qty: Math.max(1, Number(e.target.value) || 1) })}
                        />
                        <input
                          className={inputCls}
                          disabled={rx.status !== "草稿"}
                          placeholder="用法用量，医师手写"
                          value={line.usage}
                          onChange={(e) => patchLine(rx, i, { usage: e.target.value })}
                        />
                      </li>
                    ))}
                  </ul>
                  {rx.child && <p className="mt-2 text-xs text-seal">儿童处方不得使用系统剂量，须医师按体重手写。</p>}
                  {rx.pregnancy && <p className="mt-1 text-xs text-seal">妊娠不签布洛芬。</p>}
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className="text-sm">
                      医师签名
                      <input
                        className={inputCls}
                        disabled={rx.status !== "草稿"}
                        placeholder="输入医师姓名"
                        value={rx.doctorSign ?? ""}
                        onChange={(e) => patchWestRx(rx.id, { doctorSign: e.target.value })}
                      />
                      <span className="rx-sign mt-1 block">{(rx.doctorSign ?? "").trim() || "草体预览"}</span>
                    </label>
                    <label className="text-sm">
                      审核药师
                      <input
                        className={inputCls}
                        disabled={rx.status === "作废" || rx.status === "已发"}
                        placeholder="输入药师姓名"
                        value={rx.pharmacistSign ?? ""}
                        onChange={(e) => patchWestRx(rx.id, { pharmacistSign: e.target.value })}
                      />
                      <span className="rx-sign mt-1 block">{(rx.pharmacistSign ?? "").trim() || "草体预览"}</span>
                    </label>
                  </div>
                  {rx.status === "草稿" && (
                    <p className="mt-2 text-sm text-seal">{signHint(rx)}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2 print:hidden">
                    <Button
                      type="button"
                      disabled={!physician || rx.status !== "草稿"}
                      onClick={() => setMsg(signWestRx(rx.id) ? "已签署，可以去收费" : rxBlock(useClinic.getState().westRx.find((item) => item.id === rx.id) ?? rx) || "不能签署")}
                    >
                      医师签署
                    </Button>
                    <Button type="button" variant="outline" disabled={rx.status !== "已签"} onClick={() => charge(rx)}>
                      去收费
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={rx.status === "草稿" || rx.status === "作废" || rx.lines.length === 0 || !(rx.doctorSign ?? "").trim() || !(rx.pharmacistSign ?? "").trim()}
                      onClick={() => void printRx(rx.id)}
                    >
                      按程序打印
                    </Button>
                    {physician && (rx.status === "草稿" || rx.status === "已签") && (
                      <Button type="button" variant="ghost" onClick={() => voidWestRx(rx.id)}>
                        作废
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        {current && current.status !== "作废" && current.lines.length > 0 && (
          <div>
            <p className="mb-2 text-sm text-muted print:hidden">这张笺直接取自当前处方记录。签署并打上两个姓名后，打印内容与程序一致，并回写打印时间。</p>
            <RxSheet rx={current} stock={stock} />
          </div>
        )}
      </Gate>
    </ClinicShell>
  );
}

function RxSheet({ rx, stock }: { rx: WestRx; stock: WestStockItem[] }) {
  return (
    <article className="rx-sheet mx-auto mt-6 max-w-[180mm] rounded-2xl border border-border bg-white p-8 text-zinc-900">
      <p className="text-center text-sm tracking-[0.4em]">经方诊室</p>
      <h2 className="mt-1 text-center text-2xl font-extrabold">西药处方笺</h2>
      <p className="mt-2 text-center text-xs">
        {rx.id} · {rx.status}
        {rx.signedAt ? ` · 签署 ${rx.signedAt.slice(0, 16).replace("T", " ")}` : ""}
        {rx.printedAt ? ` · 打印 ${rx.printedAt.slice(0, 16).replace("T", " ")}` : ""}
      </p>
      {rx.status === "草稿" && <p className="mt-2 text-center text-sm font-semibold text-seal">草稿未签署，不得发药</p>}
      <div className="mt-4 grid grid-cols-2 gap-2 border-y border-zinc-300 py-3 text-sm">
        <p>患者：{rx.patientLabel}</p>
        <p>档案：{rx.chartId || "未建档"}</p>
        <p>过敏史：{rx.allergy || "未记录"}</p>
        <p>{rx.child ? "儿童" : "非儿童"} · {rx.pregnancy ? "妊娠" : "未标妊娠"}</p>
      </div>
      <p className="mt-3 text-sm">临床印象：{rx.impression || "未写"}</p>
      <p className="mt-4 font-serif text-lg">Rp.</p>
      <ol className="mt-2 space-y-3 text-sm">
        {rx.lines.map((line, i) => {
          const item = stock.find((row) => row.name === line.name);
          return (
            <li key={line.name}>
              <p className="font-medium">
                {i + 1}. {line.name}
                {item?.spec ? `（${item.spec}）` : ""} × {line.qty}
                {item?.unit ?? "盒"}
              </p>
              <p className="pl-4">用法：{line.usage || "未写"}</p>
            </li>
          );
        })}
      </ol>
      <div className="mt-8 flex justify-between gap-6 text-sm">
        <p>
          医师签名：
          <span className="rx-sign ml-1 inline-block min-w-28 border-b border-zinc-800 px-2">
            {rx.doctorSign || "未填写"}
          </span>
        </p>
        <p>
          审核药师：
          <span className="rx-sign ml-1 inline-block min-w-28 border-b border-zinc-800 px-2">
            {rx.pharmacistSign || "未填写"}
          </span>
        </p>
      </div>
      <p className="mt-6 text-xs text-zinc-600">本笺由经方诊室程序生成，编号、药品、用法和草体签名与系统记录一致。不是法定电子处方。</p>
    </article>
  );
}
