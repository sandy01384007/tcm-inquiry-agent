import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClinicShell } from "@/components/clinic-shell";
import { Gate } from "@/components/gate";
import { Button } from "@/components/ui/button";
import { FORMULAS } from "@/lib/tcm/formulas";
import { herbKey, lineNeed, reviewOrder, stockOf } from "@/lib/tcm/pharmacy";
import { useClinic } from "@/lib/tcm/store";
import type { DispenseOrder, StockMoveKind } from "@/lib/tcm/types";
import { WestStockPane } from "@/components/west-stock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pharmacy")({ component: PharmacyPage });

const inputCls = "h-11 rounded-md border border-border bg-bg px-3 text-sm";

function PharmacyPage() {
  const role = useClinic((s) => s.role);
  const dispenses = useClinic((s) => s.dispenses);
  const stock = useClinic((s) => s.stock);
  const moves = useClinic((s) => s.stockMoves);
  const patchDispense = useClinic((s) => s.patchDispense);
  const reviewDispense = useClinic((s) => s.reviewDispense);
  const completeDispense = useClinic((s) => s.completeDispense);
  const adjustStock = useClinic((s) => s.adjustStock);
  const seedStock = useClinic((s) => s.seedStock);
  const [pane, setPane] = useState<"发药" | "饮片" | "西药">("发药");
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [stockName, setStockName] = useState("");
  const [stockQty, setStockQty] = useState("500");
  const [stockKind, setStockKind] = useState<StockMoveKind>("入库");
  const order = dispenses.find((d) => d.id === selected) ?? null;
  const waiting = dispenses.filter((d) => d.status !== "已发药" && d.status !== "退回");
  const low = stock.filter((s) => s.qty <= s.warnAt);
  const pharmacist = role === "医师";

  return (
    <ClinicShell>
      <Gate>
        <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
          <div>
            <h1 className="text-2xl font-extrabold">药房审方</h1>
            <p className="mt-1 text-sm text-muted">收费之后才进入待发药。未审方不能发药，发完自动扣库存，并把本次就诊标成就诊完成。</p>
          </div>
          <div className="flex rounded-full border border-border bg-card p-0.5">
            {(["发药", "饮片", "西药"] as const).map((p) => (
              <button
                key={p}
                type="button"
                className={cn("min-h-11 rounded-full px-4 text-sm font-semibold", pane === p ? "bg-primary text-primary-foreground" : "text-muted")}
                onClick={() => setPane(p)}
              >
                {p === "发药" ? "审方发药" : p === "饮片" ? "饮片库存" : "西药库存"}
              </button>
            ))}
          </div>
        </div>
        {low.length > 0 && pane === "发药" && (
          <p className="mt-4 text-sm text-seal print:hidden">库存预警：{low.map((s) => `${s.name} ${s.qty}g`).join("、")}</p>
        )}
        {pane === "发药" && (
          <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <ul className="space-y-2 print:hidden">
              {waiting.length === 0 && <li className="text-sm text-muted">没有待发药处方。缴费并写了方名后会出现在这里。</li>}
              {waiting.map((d) => (
                <li key={d.id}>
                  <button type="button" onClick={() => { setSelected(d.id); setNote(d.reviewNote); }} className="w-full rounded-xl border border-border bg-card px-4 py-3 text-left">
                    <span className="font-medium">{d.patientLabel}</span>
                    <span className="ml-2 text-sm text-muted">{d.formulaName} · {d.status} · {d.doses} 剂</span>
                  </button>
                </li>
              ))}
            </ul>
            {order ? (
              <OrderCard
                order={order}
                stock={stock}
                note={note}
                setNote={setNote}
                pharmacist={pharmacist}
                onPatch={(patch) => patchDispense(order.id, patch)}
                onReview={() => setMsg(reviewDispense(order.id, note) ? "已审方，可以配药" : "有拦截项，不能审过")}
                onDispense={() => setMsg(completeDispense(order.id) ? "已发药，库存已扣，就诊完成" : "未配药、未审过或库存不足，不能发药")}
              />
            ) : (
              <p className="text-sm text-muted print:hidden">选择一张待发药处方。</p>
            )}
          </div>
        )}
        {pane === "饮片" && (
          <section className="mt-4 print:hidden">
            <div className="flex flex-wrap gap-2">
              <input className={inputCls} placeholder="饮片名" value={stockName} onChange={(e) => setStockName(e.target.value)} />
              <input className={`${inputCls} w-24`} value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
              <select className={inputCls} value={stockKind} onChange={(e) => setStockKind(e.target.value as StockMoveKind)}>
                {(["入库", "出库", "损耗"] as const).map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
              <Button
                type="button"
                disabled={!pharmacist}
                onClick={() => setMsg(adjustStock(stockName, stockKind, Number(stockQty), stockKind) ? "已写入库存流水" : "数量不够或药名无效")}
              >
                登记
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!pharmacist}
                onClick={() => seedStock([...new Set(FORMULAS.flatMap((f) => f.herbs.map((h) => herbKey(h.name))))])}
              >
                常用饮片各入库 500g
              </Button>
            </div>
            {msg && <p className="mt-3 text-sm text-muted">{msg}</p>}
            <ul className="mt-4 space-y-2">
              {stock.length === 0 && <li className="text-sm text-muted">还没有库存。未入库的饮片不能核定处方。</li>}
              {stock.map((s) => (
                <li key={s.name} className={cn("rounded-xl border bg-card px-4 py-2 text-sm", s.qty <= s.warnAt ? "border-seal" : "border-border")}>
                  {s.name} · {s.qty}g {s.qty <= s.warnAt ? "· 低于预警" : ""}
                </li>
              ))}
            </ul>
            <h2 className="mt-6 text-lg font-semibold">出入库流水</h2>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              {moves.slice(0, 30).map((m) => (
                <li key={m.id}>{new Date(m.at).toLocaleString()} · {m.kind} · {m.name} {m.qty}g · {m.note}</li>
              ))}
            </ul>
          </section>
        )}
        {pane === "西药" && <WestStockPane />}
        {pane === "发药" && msg && <p className="mt-3 text-sm text-muted print:hidden">{msg}</p>}
      </Gate>
    </ClinicShell>
  );
}

function OrderCard({
  order,
  stock,
  note,
  setNote,
  pharmacist,
  onPatch,
  onReview,
  onDispense,
}: {
  order: DispenseOrder;
  stock: { name: string; qty: number; warnAt: number }[];
  note: string;
  setNote: (v: string) => void;
  pharmacist: boolean;
  onPatch: (patch: Partial<DispenseOrder>) => void;
  onReview: () => void;
  onDispense: () => void;
}) {
  const flags = reviewOrder(order, stock);
  const blocked = flags.some((f) => f.level === "拦截");
  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted print:hidden">{order.id} · {order.status}</p>
      <h2 className="text-lg font-semibold">{order.patientLabel} · {order.formulaName}</h2>
      <label className="mt-3 block text-sm print:hidden">
        剂数
        <input
          className={`${inputCls} ml-2 w-20`}
          type="number"
          min={1}
          disabled={order.status !== "待审方"}
          value={order.doses}
          onChange={(e) => onPatch({ doses: Math.max(1, Number(e.target.value) || 1) })}
        />
      </label>
      <ul className="mt-3 space-y-1 text-sm">
        {order.lines.map((line, i) => (
          <li key={line.name} className="flex flex-wrap items-center justify-between gap-2">
            <span>{line.name} · 原方 {line.classic || "—"} · 库存 {stockOf(stock, line.name)}g</span>
            <span>
              <input
                className="h-9 w-16 rounded-md border border-border bg-bg px-2 text-sm print:hidden"
                disabled={order.status !== "待审方"}
                value={line.grams || ""}
                onChange={(e) => {
                  const grams = Number(e.target.value) || 0;
                  onPatch({ lines: order.lines.map((item, idx) => (idx === i ? { ...item, grams } : item)) });
                }}
              />
              <span className="ml-1">{line.grams}g × {order.doses} = {lineNeed(line, order.doses)}g</span>
            </span>
          </li>
        ))}
      </ul>
      <ul className="mt-3 space-y-1 text-sm">
        {flags.map((f) => (
          <li key={f.text} className={f.level === "拦截" ? "text-seal" : "text-muted"}>{f.level} · {f.text}</li>
        ))}
      </ul>
      <label className="mt-3 flex items-center gap-2 text-sm print:hidden">
        <input type="checkbox" checked={order.decoct} onChange={(e) => onPatch({ decoct: e.target.checked })} />
        代煎
      </label>
      {order.decoct && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2 print:hidden">
          <input className={inputCls} type="datetime-local" value={order.pickupAt} onChange={(e) => onPatch({ pickupAt: e.target.value })} />
          <input className={inputCls} placeholder="取药或配送地址" value={order.deliverTo} onChange={(e) => onPatch({ deliverTo: e.target.value })} />
        </div>
      )}
      <textarea className="mt-3 min-h-16 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm print:hidden" placeholder="药师复核备注" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="mt-3 flex flex-wrap gap-2 print:hidden">
        <Button type="button" disabled={!pharmacist || order.status !== "待审方" || blocked} onClick={onReview}>审方通过</Button>
        <Button type="button" variant="outline" disabled={!pharmacist || order.status !== "已审方"} onClick={() => onPatch({ status: "已配药" })}>确认配药</Button>
        <Button type="button" variant="outline" disabled={!pharmacist || order.status !== "已配药" || blocked} onClick={onDispense}>完成发药</Button>
        <Button type="button" variant="ghost" onClick={() => window.print()}>打印标签</Button>
        {pharmacist && order.status === "待审方" && (
          <Button type="button" variant="ghost" onClick={() => onPatch({ status: "退回", reviewNote: note })}>退回医师</Button>
        )}
      </div>
      {!pharmacist && <p className="mt-2 text-sm text-muted print:hidden">助手不能审方或发药。</p>}
      <div className="mt-4 hidden rounded-xl border border-border p-3 print:block">
        <p className="font-semibold">药品标签 · {order.patientLabel}</p>
        <p>{order.formulaName} · {order.doses} 剂 {order.decoct ? `· 代煎 ${order.pickupAt.replace("T", " ")} ${order.deliverTo}` : ""}</p>
        <p>{order.lines.map((l) => `${l.name}${l.grams}g`).join("，")}</p>
      </div>
      {order.decoct && order.status === "已发药" && (
        <p className="mt-2 text-sm">代煎记录：{order.pickupAt || "未约取药时间"} · {order.deliverTo || "自取"}</p>
      )}
    </article>
  );
}
