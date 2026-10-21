import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ClinicShell } from "@/components/clinic-shell";
import { Gate } from "@/components/gate";
import { Button } from "@/components/ui/button";
import { compressTongueFile } from "@/lib/tcm/image";
import { parseYuan, sumFen, westUnitFen, yuan } from "@/lib/tcm/money";
import { useClinic } from "@/lib/tcm/store";
import { PAY_METHODS, type Bill, type BillItem, type BillItemKind, type PayMethod } from "@/lib/tcm/types";
import { WESTERN } from "@/lib/tcm/western";
import { availableWest, bannedWest, westName } from "@/lib/tcm/west-stock";
import { coveringRx } from "@/lib/tcm/west-rx";

export const Route = createFileRoute("/billing")({ component: BillingPage });

function westShortage(
  rows: BillItem[],
  stock: { name: string; qty: number; expiry: string; spec: string; unit: "盒" | "瓶" | "板" | "支"; warnAt: number; batch: string; priceFen: number }[],
  orders: { status: "待核" | "已发" | "退回"; lines: { name: string; qty: number }[] }[],
) {
  const names = rows.filter((row) => itemKind(row) === "西药").map((row) => westName(row.name)).filter(Boolean);
  const banned = names.filter((name) => bannedWest(name));
  if (banned.length) return `不能收取：${banned.join("、")}。本系统不收抗生素、麻醉药品和注射剂。`;
  const short = names.filter((name) => {
    const need = Math.max(1, rows.find((row) => westName(row.name) === name && itemKind(row) === "西药")?.qty ?? 1);
    return availableWest(stock, orders, name) < need;
  });
  if (short.length) return `西药库存不足或已过期，不能收款：${short.join("、")}。请先在药房入库。`;
  return "";
}

function patientLabel() {
  const p = useClinic.getState().patient;
  return [p.name || "未署名", p.sex, p.age ? `${p.age}岁` : "", p.ref].filter(Boolean).join(" · ");
}

function itemKind(row: BillItem): BillItemKind {
  if (row.kind) return row.kind;
  if (row.name.startsWith("西药")) return "西药";
  if (row.name.includes("挂号")) return "挂号";
  if (row.name.startsWith("中药")) return "中药";
  if (row.name.includes("代煎")) return "代煎";
  if (row.name.includes("诊金")) return "诊金";
  return "其他";
}

const CHARGE_KINDS: BillItemKind[] = ["挂号", "诊金", "中药", "西药", "代煎", "其他"];

function BillingPage() {
  const bills = useClinic((s) => s.bills);
  const followups = useClinic((s) => s.followups);
  const payCodes = useClinic((s) => s.payCodes);
  const setPayCodes = useClinic((s) => s.setPayCodes);
  const saveBill = useClinic((s) => s.saveBill);
  const updateBill = useClinic((s) => s.updateBill);
  const draft = useClinic((s) => s.billDraft);
  const setBillDraft = useClinic((s) => s.setBillDraft);
  const role = useClinic((s) => s.role);
  const chartId = useClinic((s) => s.patient.chartId);
  const registrationId = useClinic((s) => s.patient.registrationId);
  const westStock = useClinic((s) => s.westStock);
  const westOrders = useClinic((s) => s.westOrders);
  const westRx = useClinic((s) => s.westRx);
  const fees = useClinic((s) => s.fees);
  const setFees = useClinic((s) => s.setFees);
  const wxRef = useRef<HTMLInputElement>(null);
  const aliRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<BillItem[]>(() => {
    const saved = useClinic.getState();
    if (draft?.items?.length) return draft.items;
    return [
      { name: "挂号费", amountFen: saved.fees.regFen, kind: "挂号" },
      { name: "诊金", amountFen: saved.fees.consultFen, kind: "诊金" },
      { name: draft?.formulaName ? `中药 ${draft.formulaName}` : "中药", amountFen: saved.fees.herbFen, kind: "中药" },
      { name: "代煎", amountFen: saved.fees.decoctFen, kind: "代煎" },
    ];
  });
  const [method, setMethod] = useState<PayMethod>("微信");
  const [note, setNote] = useState("");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [consultFee, setConsultFee] = useState(yuan(fees.consultFen));
  const [herbFee, setHerbFee] = useState(yuan(fees.herbFen));
  const [decoctFee, setDecoctFee] = useState(yuan(fees.decoctFen));
  const [regFee, setRegFee] = useState(yuan(fees.regFen));

  useEffect(() => {
    setConsultFee(yuan(fees.consultFen));
    setHerbFee(yuan(fees.herbFen));
    setDecoctFee(yuan(fees.decoctFen));
    setRegFee(yuan(fees.regFen));
  }, [fees.consultFen, fees.herbFen, fees.decoctFen, fees.regFen]);

  const total = useMemo(() => sumFen(items), [items]);
  const westFen = useMemo(() => sumFen(items.filter((row) => itemKind(row) === "西药")), [items]);
  const current = bills.find((b) => b.id === currentId);
  const todayFen = bills
    .filter((b) => b.status === "已收" && b.paidAt?.slice(0, 10) === new Date().toISOString().slice(0, 10))
    .reduce((a, b) => a + sumFen(b.items), 0);

  function patchItem(i: number, patch: Partial<BillItem>) {
    setItems((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function onQr(kind: "wechat" | "alipay", file?: File) {
    if (!file) return;
    try {
      const dataUrl = await compressTongueFile(file, 480);
      setPayCodes({ [kind]: dataUrl });
      setMsg(kind === "wechat" ? "微信收款码已保存" : "支付宝收款码已保存");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "无法读取收款码");
    }
  }

  function createBill(status: Bill["status"]) {
    if (!chartId) {
      setMsg("未建档患者不能结算。请先在看诊页建档并挂号。");
      return;
    }
    if (total <= 0) {
      setMsg("请填写大于 0 的金额");
      return;
    }
    const problem = westShortage(items, westStock, westOrders);
    if (problem) {
      setMsg(problem);
      return;
    }
    const rx = coveringRx(westRx, chartId, items);
    if (items.some((row) => itemKind(row) === "西药" && westName(row.name)) && !rx) {
      setMsg("西药须先由有处方权的医师签署处方，再来收费。");
      return;
    }
    const bill: Bill = {
      id: `B-${Date.now()}`,
      createdAt: new Date().toISOString(),
      paidAt: status === "已收" ? new Date().toISOString() : undefined,
      patientLabel: patientLabel(),
      consultId: draft?.consultId,
      formulaName: draft?.formulaName,
      chartId,
      registrationId,
      rxId: rx?.id,
      items: items.filter((x) => x.name.trim()),
      method,
      status,
      note,
    };
    saveBill(bill);
    setCurrentId(bill.id);
    setBillDraft(null);
    setMsg(status === "已收" ? "已记入收款，并按规则生成随访任务" : "收款单已生成，请患者扫码后点确认已收");
  }

  const qr = method === "微信" ? payCodes.wechat : method === "支付宝" ? payCodes.alipay : "";

  return (
    <ClinicShell>
      <Gate>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">收费收款</h1>
            <p className="mt-1 text-sm text-muted">
              出示诊所微信 / 支付宝收款码，确认到账后入账。非正式微信支付商户清算。
            </p>
          </div>
          <p className="text-sm">
            今日已收 <span className="font-medium">{yuan(todayFen)}元</span>
          </p>
        </div>

        <section className="mt-4 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">收费金额设置</h2>
          <p className="mt-1 text-xs text-muted">保存后，挂号费、诊金、中药、代煎和本单里的其他费用一起计入合计。西药按药房单价乘盒数。</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            {(
              [
                ["诊金", consultFee, setConsultFee],
                ["中药", herbFee, setHerbFee],
                ["代煎", decoctFee, setDecoctFee],
                ["挂号费", regFee, setRegFee],
              ] as const
            ).map(([label, value, setValue]) => (
              <label key={label} className="text-xs text-muted">
                {label}（元）
                <input
                  className="mt-1 h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg"
                  inputMode="decimal"
                  value={value}
                  disabled={role !== "医师"}
                  onChange={(e) => setValue(e.target.value)}
                />
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={role !== "医师"}
              onClick={() => {
                const next = {
                  consultFen: parseYuan(consultFee),
                  herbFen: parseYuan(herbFee),
                  decoctFen: parseYuan(decoctFee),
                  regFen: parseYuan(regFee),
                };
                setFees(next);
                setItems((rows) => {
                  const priced = rows.map((row) => {
                    const kind = itemKind(row);
                    if (kind === "挂号") return { ...row, name: row.name || "挂号费", amountFen: next.regFen, kind: "挂号" as const };
                    if (kind === "诊金") return { ...row, amountFen: next.consultFen, kind: "诊金" as const };
                    if (kind === "中药") return { ...row, amountFen: next.herbFen, kind: "中药" as const };
                    if (kind === "代煎") return { ...row, amountFen: next.decoctFen, kind: "代煎" as const };
                    if (kind === "西药") {
                      const unit = westUnitFen(westStock, westName(row.name));
                      return unit > 0 ? { ...row, amountFen: unit * Math.max(1, row.qty ?? 1) } : row;
                    }
                    return row;
                  });
                  const extra: BillItem[] = [];
                  if (!priced.some((row) => itemKind(row) === "挂号")) extra.push({ name: "挂号费", amountFen: next.regFen, kind: "挂号" });
                  if (!priced.some((row) => itemKind(row) === "诊金")) extra.push({ name: "诊金", amountFen: next.consultFen, kind: "诊金" });
                  if (!priced.some((row) => itemKind(row) === "中药")) {
                    extra.push({ name: draft?.formulaName ? `中药 ${draft.formulaName}` : "中药", amountFen: next.herbFen, kind: "中药" });
                  }
                  if (!priced.some((row) => itemKind(row) === "代煎")) extra.push({ name: "代煎", amountFen: next.decoctFen, kind: "代煎" });
                  return [...extra, ...priced];
                });
                setMsg("金额已保存。挂号费、诊金、中药、代煎和已有的其他费用已计入合计。");
              }}
            >
              保存金额
            </Button>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-medium">{patientLabel()}</p>
            {draft?.formulaName && (
              <p className="mt-1 text-xs text-muted">关联方剂：{draft.formulaName}</p>
            )}
            <ul className="mt-4 space-y-2">
              {items.map((row, i) => (
                <li key={`${row.name}-${i}`} className="grid grid-cols-[5.5rem_1fr_7rem] gap-2">
                  <select
                    className="h-11 rounded-md border border-border bg-bg px-2 text-sm"
                    value={itemKind(row)}
                    onChange={(e) => patchItem(i, { kind: e.target.value as BillItemKind })}
                  >
                    {CHARGE_KINDS.map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                  <input
                    className="h-11 rounded-md border border-border bg-bg px-3 text-sm"
                    value={row.name}
                    onChange={(e) => patchItem(i, { name: e.target.value })}
                  />
                  <input
                    className="h-11 rounded-md border border-border bg-bg px-3 text-sm"
                    inputMode="decimal"
                    value={yuan(row.amountFen)}
                    onChange={(e) => patchItem(i, { amountFen: parseYuan(e.target.value) })}
                  />
                </li>
              ))}
            </ul>
            <ul className="mt-2 space-y-1 text-xs text-muted">
              {items.map((row, i) =>
                itemKind(row) === "西药" && westName(row.name) ? (
                  <li key={`west-${i}`} className="flex items-center gap-2">
                    <span>
                      {westName(row.name)} 可售 {availableWest(westStock, westOrders, westName(row.name))}
                      {westStock.find((item) => item.name === westName(row.name))?.unit ?? "盒"}
                    </span>
                    <input
                      className="h-9 w-16 rounded-md border border-border bg-bg px-2 text-sm"
                      type="number"
                      min={1}
                      value={row.qty ?? 1}
                      onChange={(e) => {
                        const qty = Math.max(1, Number(e.target.value) || 1);
                        const unit = westUnitFen(westStock, westName(row.name));
                        patchItem(i, { qty, amountFen: unit > 0 ? unit * qty : row.amountFen });
                      }}
                    />
                    <span>盒</span>
                  </li>
                ) : null,
              )}
            </ul>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setItems((rows) => [...rows, { name: "", amountFen: 0, kind: "其他" }])}
              >
                加一行
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setItems((rows) => [...rows, { name: "西药 ", amountFen: 0, kind: "西药", qty: 1 }])}
              >
                加西药
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {WESTERN.filter((w) => w.id !== "oral-rehydration-fever").map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className="min-h-11 rounded-full border border-border px-3 text-xs"
                  onClick={() =>
                    setItems((rows) =>
                      rows.some((r) => r.name === `西药 ${w.name}`)
                        ? rows
                        : [...rows, { name: `西药 ${w.name}`, amountFen: westUnitFen(westStock, w.name), kind: "西药", qty: 1 }],
                    )
                  }
                >
                  {w.name}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">金额按下方收费设置和西药单价带入，这一单仍可改。西药须先有已签处方。</p>
            <p className="mt-3 text-lg font-semibold">合计 {yuan(total)}元</p>
            <p className="text-sm text-muted">
              {CHARGE_KINDS.map((kind) => `${kind} ${yuan(sumFen(items.filter((row) => itemKind(row) === kind)))}元`).join(" · ")}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {PAY_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`min-h-11 rounded-md border px-3 text-sm ${
                    method === m
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-bg"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <textarea
              className="mt-3 min-h-20 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
              placeholder="备注，如 3 剂、自煎"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="mt-4 flex flex-wrap gap-2 print:hidden">
              <Button type="button" variant="outline" disabled={total <= 0} onClick={() => createBill("待收")}>
                生成收款单
              </Button>
              <Button type="button" disabled={total <= 0} onClick={() => createBill("已收")}>
                {method === "现金" ? "确认收现" : "确认已收"}
              </Button>
              {current?.status === "待收" && (
                <Button
                  type="button"
                  onClick={() => {
                    const id = current.chartId || chartId;
                    if (!id) {
                      setMsg("未建档患者不能结算。");
                      return;
                    }
                    const problem = westShortage(current.items, westStock, westOrders);
                    if (problem) {
                      setMsg(problem);
                      return;
                    }
                    const rx = coveringRx(westRx, current.chartId || chartId, current.items);
                    if (current.items.some((row) => itemKind(row) === "西药" && westName(row.name)) && !rx && !current.rxId) {
                      setMsg("这张单有西药，但没有已签处方。");
                      return;
                    }
                    updateBill(current.id, {
                      status: "已收",
                      paidAt: new Date().toISOString(),
                      chartId: id,
                      registrationId: current.registrationId || registrationId,
                      rxId: current.rxId || rx?.id,
                    });
                  }}
                >
                  标记当前单已收
                </Button>
              )}
            </div>
            {msg && <p className="mt-3 text-sm text-muted">{msg}</p>}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 print:border-0">
            <p className="text-sm font-medium">
              {method === "现金" ? "现金收款" : `${method}收款码`}
            </p>
            {method !== "现金" && (
              <>
                <p className="mt-1 text-xs text-muted">
                  上传本诊所收款码。患者按上方合计金额转账，到账后点确认已收。
                </p>
                <div className="mt-3 flex gap-2 print:hidden">
                  <Button type="button" variant="outline" size="sm" onClick={() => wxRef.current?.click()}>
                    上传微信码
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => aliRef.current?.click()}>
                    上传支付宝码
                  </Button>
                </div>
                <input
                  ref={wxRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    void onQr("wechat", e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={aliRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    void onQr("alipay", e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                {qr ? (
                  <img
                    src={qr}
                    alt={`${method}收款码`}
                    className="mx-auto mt-4 h-56 w-56 rounded-xl border border-border object-contain bg-bg"
                  />
                ) : (
                  <p className="mt-6 text-sm text-muted">尚未上传{method}收款码。</p>
                )}
              </>
            )}
            <p className="mt-4 text-center text-2xl font-semibold">{yuan(current ? sumFen(current.items) : total)}元</p>
            {(current ? sumFen(current.items.filter((item) => itemKind(item) === "西药")) : westFen) > 0 && (
              <p className="mt-1 text-center text-sm text-muted">
                含西药 {yuan(current ? sumFen(current.items.filter((item) => itemKind(item) === "西药")) : westFen)}元
              </p>
            )}
            <p className="mt-1 text-center text-xs text-muted">
              {(current ?? { patientLabel: patientLabel() }).patientLabel} · {method}
              {current ? ` · ${current.status}` : ""}
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 w-full print:hidden"
              onClick={() => window.print()}
            >
              打印回执
            </Button>
            <p className="mt-3 text-xs text-muted">
              微信/支付宝官方商户 API（JSAPI/Native）需商户号与证书，未配置前使用收款码入账。本系统不经手资金清算。
            </p>
          </div>
        </section>

        <h2 className="mt-8 text-lg font-semibold">收款记录</h2>
        {bills.length === 0 && <p className="mt-2 text-sm text-muted">暂无账单。</p>}
        <ul className="mt-3 space-y-2">
          {bills.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
              <div>
                <p className="text-sm font-medium">
                  {b.patientLabel} · {b.method} · {yuan(sumFen(b.items))}元
                </p>
                <p className="text-xs text-muted">
                  {b.status} · {new Date(b.paidAt || b.createdAt).toLocaleString()}
                  {b.formulaName ? ` · ${b.formulaName}` : ""}
                  {b.items.some((item) => itemKind(item) === "西药")
                    ? ` · 西药 ¥${yuan(sumFen(b.items.filter((item) => itemKind(item) === "西药")))}`
                    : ""}
                  {followups.some((f) => f.billId === b.id) ? (
                    <>
                      {" · "}
                      <Link to="/followup" className="text-primary">
                        已排随访
                      </Link>
                    </>
                  ) : (
                    ""
                  )}
                </p>
              </div>
              <div className="flex gap-2 print:hidden">
                <Button type="button" variant="outline" size="sm" onClick={() => setCurrentId(b.id)}>
                  出示
                </Button>
                {b.status === "待收" && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      if (!b.chartId && !chartId) {
                        setMsg("这张单没有档案，不能结算。");
                        return;
                      }
                      const problem = westShortage(b.items, westStock, westOrders);
                      if (problem) {
                        setMsg(problem);
                        return;
                      }
                      const rx = coveringRx(westRx, b.chartId || chartId, b.items);
                      if (b.items.some((row) => itemKind(row) === "西药" && westName(row.name)) && !rx && !b.rxId) {
                        setMsg("这张单有西药，但没有已签处方。");
                        return;
                      }
                      updateBill(b.id, { status: "已收", paidAt: new Date().toISOString(), chartId: b.chartId || chartId, registrationId: b.registrationId || registrationId, rxId: b.rxId || rx?.id })
                    }}
                  >
                    已收
                  </Button>
                )}
                {role === "医师" && b.status !== "作废" && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => updateBill(b.id, { status: "作废" })}>
                    作废
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Gate>
    </ClinicShell>
  );
}
