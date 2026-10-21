import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useClinic } from "@/lib/tcm/store";
import type { StockMoveKind, WestUnit } from "@/lib/tcm/types";
import { availableWest, bannedWest, expiryState } from "@/lib/tcm/west-stock";
import { parseYuan, yuan } from "@/lib/tcm/money";
import { WESTERN } from "@/lib/tcm/western";
import { cn } from "@/lib/utils";

const inputCls = "h-11 rounded-md border border-border bg-bg px-3 text-sm";
const UNITS: WestUnit[] = ["盒", "瓶", "板", "支"];

export function WestStockPane() {
  const role = useClinic((s) => s.role);
  const stock = useClinic((s) => s.westStock);
  const moves = useClinic((s) => s.westMoves);
  const orders = useClinic((s) => s.westOrders);
  const adjustWest = useClinic((s) => s.adjustWest);
  const patchWestOrder = useClinic((s) => s.patchWestOrder);
  const rejectWest = useClinic((s) => s.rejectWest);
  const dispenseWest = useClinic((s) => s.dispenseWest);
  const [name, setName] = useState("");
  const [spec, setSpec] = useState("");
  const [batch, setBatch] = useState("");
  const [expiry, setExpiry] = useState("");
  const [unit, setUnit] = useState<WestUnit>("盒");
  const [qty, setQty] = useState("10");
  const [price, setPrice] = useState("");
  const [kind, setKind] = useState<StockMoveKind>("入库");
  const [msg, setMsg] = useState("");
  const pharmacist = role === "医师";
  const waiting = orders.filter((order) => order.status === "待核");
  const alerts = stock.filter((item) => item.qty <= item.warnAt || expiryState(item.expiry) !== "ok" && expiryState(item.expiry) !== "none");

  function saveMove() {
    if (bannedWest(name)) {
      setMsg("抗生素、麻醉药品和注射剂不能入库。");
      return;
    }
    setMsg(
      adjustWest({ name, spec, unit, qty: Number(qty), kind, note: kind, batch, expiry, priceFen: parseYuan(price) })
        ? "已写入西药库存"
        : "数量不够或药名无效",
    );
  }

  return (
    <div className="mt-4 space-y-6">
      <section>
        <h2 className="text-lg font-semibold">待发西药</h2>
        <p className="mt-1 text-sm text-muted">收费到账后按盒扣库存。过期、过敏、抗生素、麻醉药和注射剂不能发。</p>
        {waiting.length === 0 && <p className="mt-2 text-sm text-muted">没有待发西药。</p>}
        <ul className="mt-3 space-y-3">
          {waiting.map((order) => (
            <li key={order.id} className="rounded-xl border border-border bg-card p-3 text-sm">
              <p className="font-medium">{order.patientLabel}</p>
              {order.allergy && <p className="text-seal">过敏史：{order.allergy}</p>}
              {order.lines.map((line, i) => {
                const have = stock.find((item) => item.name === line.name);
                const blocked =
                  bannedWest(line.name) ||
                  (order.allergy && order.allergy.includes(line.name)) ||
                  expiryState(have?.expiry ?? "") === "expired";
                return (
                  <div key={line.name} className="mt-2 flex flex-wrap items-center gap-2">
                    <span>
                      {line.name} · 可发 {availableWest(stock, orders, line.name)}
                      {have?.unit ?? "盒"}
                      {have?.batch ? ` · 批号 ${have.batch}` : ""}
                      {have?.expiry ? ` · 效期 ${have.expiry}` : ""}
                    </span>
                    <input
                      className="h-9 w-16 rounded-md border border-border bg-bg px-2"
                      type="number"
                      min={1}
                      value={line.qty}
                      onChange={(e) =>
                        patchWestOrder(
                          order.id,
                          order.lines.map((item, idx) => (idx === i ? { ...item, qty: Math.max(1, Number(e.target.value) || 1) } : item)),
                        )
                      }
                    />
                    {blocked && <span className="text-seal">不能发</span>}
                  </div>
                );
              })}
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    !pharmacist ||
                    order.lines.some(
                      (line) =>
                        bannedWest(line.name) ||
                        (order.allergy && order.allergy.includes(line.name)) ||
                        expiryState(stock.find((item) => item.name === line.name)?.expiry ?? "") === "expired",
                    )
                  }
                  onClick={() => setMsg(dispenseWest(order.id) ? "西药已发，库存已扣" : "未核对通过，或库存不足、已过期")}
                >
                  核对发药
                </Button>
                {pharmacist && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => rejectWest(order.id)}>
                    退回
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold">西药库存</h2>
        {alerts.length > 0 && (
          <p className="mt-2 text-sm text-seal">
            预警：
            {alerts
              .map((item) => {
                const exp = expiryState(item.expiry);
                return `${item.name}${item.qty <= item.warnAt ? ` 剩${item.qty}${item.unit}` : ""}${exp === "expired" ? " 已过期" : ""}${exp === "near" ? " 近效期" : ""}`;
              })
              .join("、")}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {WESTERN.filter((drug) => drug.id !== "oral-rehydration-fever").map((drug) => (
            <button key={drug.id} type="button" className="min-h-11 rounded-full border border-border px-3 text-xs" onClick={() => setName(drug.name)}>
              {drug.name}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <input className={inputCls} placeholder="药品通用名" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={inputCls} placeholder="规格，如 0.5g×20片" value={spec} onChange={(e) => setSpec(e.target.value)} />
          <input className={inputCls} placeholder="批号" value={batch} onChange={(e) => setBatch(e.target.value)} />
          <input className={inputCls} type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          <select className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value as WestUnit)}>
            {UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
          <input className={`${inputCls} w-20`} value={qty} onChange={(e) => setQty(e.target.value)} />
          <input className={`${inputCls} w-24`} inputMode="decimal" placeholder="单价元" value={price} onChange={(e) => setPrice(e.target.value)} />
          <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as StockMoveKind)}>
            {(["入库", "出库", "损耗"] as const).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
          <Button type="button" disabled={!pharmacist} onClick={saveMove}>
            登记
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">数量单位是盒、瓶、板或支。效期 90 天内会预警，过期不能发药。助手不能改库存。</p>
        {msg && <p className="mt-3 text-sm text-muted">{msg}</p>}
        <ul className="mt-4 space-y-2">
          {stock.length === 0 && <li className="text-sm text-muted">还没有西药库存。未入库不能收款，也不能发出。</li>}
          {stock.map((item) => {
            const exp = expiryState(item.expiry);
            return (
              <li
                key={item.name}
                className={cn(
                  "rounded-xl border bg-card px-4 py-2 text-sm",
                  item.qty <= item.warnAt || exp === "expired" || exp === "near" ? "border-seal" : "border-border",
                )}
              >
                {item.name} · {item.spec || "未写规格"} · {item.qty}
                {item.unit} · ¥{yuan(item.priceFen ?? 0)}/{item.unit}
                {item.batch ? ` · 批号 ${item.batch}` : ""}
                {item.expiry ? ` · 效期 ${item.expiry}` : ""}
                {item.qty <= item.warnAt ? " · 低库存" : ""}
                {exp === "near" ? " · 近效期" : ""}
                {exp === "expired" ? " · 已过期" : ""}
              </li>
            );
          })}
        </ul>
        <h3 className="mt-6 font-semibold">西药流水</h3>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          {moves.slice(0, 30).map((move) => (
            <li key={move.id}>
              {new Date(move.at).toLocaleString()} · {move.kind} · {move.name} {move.qty} · {move.note}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
