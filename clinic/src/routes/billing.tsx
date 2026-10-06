import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { ClinicShell } from "@/components/clinic-shell";
import { Gate } from "@/components/gate";
import { Button } from "@/components/ui/button";
import { compressTongueFile } from "@/lib/tcm/image";
import { parseYuan, sumFen, yuan } from "@/lib/tcm/money";
import { useClinic } from "@/lib/tcm/store";
import { PAY_METHODS, type Bill, type BillItem, type PayMethod } from "@/lib/tcm/types";

export const Route = createFileRoute("/billing")({ component: BillingPage });

function patientLabel() {
  const p = useClinic.getState().patient;
  return [p.name || "未署名", p.sex, p.age ? `${p.age}岁` : "", p.ref].filter(Boolean).join(" · ");
}

function BillingPage() {
  const bills = useClinic((s) => s.bills);
  const payCodes = useClinic((s) => s.payCodes);
  const setPayCodes = useClinic((s) => s.setPayCodes);
  const saveBill = useClinic((s) => s.saveBill);
  const updateBill = useClinic((s) => s.updateBill);
  const draft = useClinic((s) => s.billDraft);
  const setBillDraft = useClinic((s) => s.setBillDraft);
  const role = useClinic((s) => s.role);
  const wxRef = useRef<HTMLInputElement>(null);
  const aliRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<BillItem[]>(
    draft?.items?.length
      ? draft.items
      : [
          { name: "诊金", amountFen: 5000 },
          { name: draft?.formulaName ? `中药 ${draft.formulaName}` : "中药", amountFen: 0 },
          { name: "代煎", amountFen: 1000 },
        ],
  );
  const [method, setMethod] = useState<PayMethod>("微信");
  const [note, setNote] = useState("");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const total = useMemo(() => sumFen(items), [items]);
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
    if (total <= 0) {
      setMsg("请填写大于 0 的金额");
      return;
    }
    const bill: Bill = {
      id: `B-${Date.now()}`,
      createdAt: new Date().toISOString(),
      paidAt: status === "已收" ? new Date().toISOString() : undefined,
      patientLabel: patientLabel(),
      consultId: draft?.consultId,
      formulaName: draft?.formulaName,
      items: items.filter((x) => x.name.trim()),
      method,
      status,
      note,
    };
    saveBill(bill);
    setCurrentId(bill.id);
    setBillDraft(null);
    setMsg(status === "已收" ? "已记入收款" : "收款单已生成，请患者扫码后点确认已收");
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
            今日已收 <span className="font-medium">¥{yuan(todayFen)}</span>
          </p>
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-medium">{patientLabel()}</p>
            {draft?.formulaName && <p className="mt-1 text-xs text-muted">关联方剂：{draft.formulaName}</p>}
            <ul className="mt-4 space-y-2">
              {items.map((row, i) => (
                <li key={`${row.name}-${i}`} className="grid grid-cols-[1fr_7rem] gap-2">
                  <input className="h-11 rounded-md border border-border bg-bg px-3 text-sm" value={row.name} onChange={(e) => patchItem(i, { name: e.target.value })} />
                  <input className="h-11 rounded-md border border-border bg-bg px-3 text-sm" inputMode="decimal" value={yuan(row.amountFen)} onChange={(e) => patchItem(i, { amountFen: parseYuan(e.target.value) })} />
                </li>
              ))}
            </ul>
            <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setItems((rows) => [...rows, { name: "", amountFen: 0 }])}>
              加一行
            </Button>
            <p className="mt-3 text-lg font-semibold">合计 ¥{yuan(total)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {PAY_METHODS.map((m) => (
                <button key={m} type="button" onClick={() => setMethod(m)} className={`min-h-11 rounded-md border px-3 text-sm ${
                  method === m ? "border-primary bg-primary text-primary-foreground" : "border-border bg-bg"
                }`}>
                  {m}
                </button>
              ))}
            </div>
            <textarea className="mt-3 min-h-20 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm" placeholder="备注，如 3 剂、自煎" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="mt-4 flex flex-wrap gap-2 print:hidden">
              <Button type="button" variant="outline" disabled={total <= 0} onClick={() => createBill("待收")}>生成收款单</Button>
              <Button type="button" disabled={total <= 0} onClick={() => createBill("已收")}>
                {method === "现金" ? "确认收现" : "确认已收"}
              </Button>
              {current?.status === "待收" && (
                <Button type="button" onClick={() => updateBill(current.id, { status: "已收", paidAt: new Date().toISOString() })}>
                  标记当前单已收
                </Button>
              )}
            </div>
            {msg && <p className="mt-3 text-sm text-muted">{msg}</p>}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 print:border-0">
            <p className="text-sm font-medium">{method === "现金" ? "现金收款" : `${method}收款码`}</p>
            {method !== "现金" && (
              <>
                <p className="mt-1 text-xs text-muted">上传本诊所收款码。患者按上方合计金额转账，到账后点确认已收。</p>
                <div className="mt-3 flex gap-2 print:hidden">
                  <Button type="button" variant="outline" size="sm" onClick={() => wxRef.current?.click()}>上传微信码</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => aliRef.current?.click()}>上传支付宝码</Button>
                </div>
                <input ref={wxRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onQr("wechat", e.target.files?.[0]); e.target.value = ""; }} />
                <input ref={aliRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onQr("alipay", e.target.files?.[0]); e.target.value = ""; }} />
                {qr ? (
                  <img src={qr} alt={`${method}收款码`} className="mx-auto mt-4 h-56 w-56 rounded-xl border border-border object-contain bg-bg" />
                ) : (
                  <p className="mt-6 text-sm text-muted">尚未上传{method}收款码。</p>
                )}
              </>
            )}
            <p className="mt-4 text-center text-2xl font-semibold">¥{yuan(current ? sumFen(current.items) : total)}</p>
            <p className="mt-1 text-center text-xs text-muted">
              {(current ?? { patientLabel: patientLabel() }).patientLabel} · {method}{current ? ` · ${current.status}` : ""}
            </p>
            <Button type="button" variant="outline" className="mt-4 w-full print:hidden" onClick={() => window.print()}>打印回执</Button>
            <p className="mt-3 text-xs text-muted">微信/支付宝官方商户 API 需商户号与证书，未配置前使用收款码入账。本系统不经手资金清算。</p>
          </div>
        </section>

        <h2 className="mt-8 text-lg font-semibold">收款记录</h2>
        {bills.length === 0 && <p className="mt-2 text-sm text-muted">暂无账单。</p>}
        <ul className="mt-3 space-y-2">
          {bills.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
              <div>
                <p className="text-sm font-medium">{b.patientLabel} · {b.method} · ¥{yuan(sumFen(b.items))}</p>
                <p className="text-xs text-muted">
                  {b.status} · {new Date(b.paidAt || b.createdAt).toLocaleString()}{b.formulaName ? ` · ${b.formulaName}` : ""}
                </p>
              </div>
              <div className="flex gap-2 print:hidden">
                <Button type="button" variant="outline" size="sm" onClick={() => setCurrentId(b.id)}>出示</Button>
                {b.status === "待收" && (
                  <Button type="button" size="sm" onClick={() => updateBill(b.id, { status: "已收", paidAt: new Date().toISOString() })}>已收</Button>
                )}
                {role === "医师" && b.status !== "作废" && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => updateBill(b.id, { status: "作废" })}>作废</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Gate>
    </ClinicShell>
  );
}
