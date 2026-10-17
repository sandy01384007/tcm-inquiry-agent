import { mergeFormulas } from "./catalog";
import type { Bill, DispenseLine, DispenseOrder, Formula, ReviewFlag, StockItem } from "./types";

const CLASH: [string, string[]][] = [
  ["甘草", ["甘遂", "大戟", "芫花", "海藻"]],
  ["乌头", ["贝母", "瓜蒌", "半夏", "白蔹", "白及"]],
  ["藜芦", ["人参", "沙参", "丹参", "玄参", "细辛", "芍药"]],
];

const PREGNANCY = ["麻黄", "附子", "乌头", "大黄", "芒硝", "桃仁", "红花", "牛膝", "麝香"];
const CHILD = ["麻黄", "附子", "乌头", "细辛", "大黄", "芒硝"];

export function herbKey(name: string) {
  return name.replace(/（[^）]*）|\([^)]*\)/g, "").replace(/\s/g, "");
}

export function parseGrams(modern?: string) {
  const m = (modern ?? "").match(/(\d+(?:\.\d+)?)\s*g/i);
  return m ? Number(m[1]) : 0;
}

export function sameHerb(a: string, b: string) {
  const x = herbKey(a);
  const y = herbKey(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

export function stockOf(stock: StockItem[], name: string) {
  return stock.find((s) => sameHerb(s.name, name))?.qty ?? 0;
}

export function lineNeed(line: DispenseLine, doses: number) {
  return Math.round(line.grams * Math.max(1, doses) * 10) / 10;
}

export function stockGaps(lines: { name: string; grams: number }[], stock: StockItem[], doses: number) {
  return lines
    .map((line) => {
      const need = lineNeed({ ...line, classic: "" }, doses);
      const have = stockOf(stock, line.name);
      return { name: line.name, need, have, short: need > 0 && have < need };
    })
    .filter((x) => x.short || x.need === 0);
}

export function reviewOrder(order: Pick<DispenseOrder, "lines" | "allergy" | "pregnancy" | "child" | "doses">, stock: StockItem[]): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  const names = order.lines.map((l) => l.name);
  for (const [left, rights] of CLASH) {
    if (!names.some((n) => sameHerb(n, left))) continue;
    for (const right of rights) {
      const hit = names.find((n) => sameHerb(n, right));
      if (hit) flags.push({ level: "拦截", text: `配伍禁忌：${left} 与 ${hit}` });
    }
  }
  for (const line of order.lines) {
    if (line.grams <= 0) flags.push({ level: "拦截", text: `${line.name} 没有克数，不能审过` });
    if (order.allergy && sameHerb(order.allergy, line.name)) {
      flags.push({ level: "拦截", text: `过敏史涉及 ${line.name}` });
    } else if (order.allergy && order.allergy.includes(herbKey(line.name).slice(0, 2))) {
      flags.push({ level: "关注", text: `过敏史「${order.allergy}」请药师再核对 ${line.name}` });
    }
    if (order.pregnancy && PREGNANCY.some((p) => sameHerb(line.name, p))) {
      flags.push({ level: "拦截", text: `妊娠慎用 ${line.name}` });
    }
    if (order.child && CHILD.some((p) => sameHerb(line.name, p))) {
      flags.push({ level: "关注", text: `儿童使用 ${line.name}，须医师已核定剂量` });
    }
    const need = lineNeed(line, order.doses);
    if (line.grams > 0 && stockOf(stock, line.name) < need) {
      flags.push({ level: "拦截", text: `${line.name} 库存不足，需要 ${need}g` });
    }
  }
  if (!flags.length) flags.push({ level: "通过", text: "药品、剂量、配伍和人群未见拦截项" });
  return flags;
}

export function orderFromBill(bill: Bill, extra: Formula[], allergy: string, pregnancy: boolean, child: boolean): DispenseOrder | null {
  if (bill.status !== "已收" || !bill.formulaName) return null;
  const formula = mergeFormulas(extra).find((f) => f.name === bill.formulaName);
  const decoct = bill.items.some((i) => i.name.includes("代煎"));
  return {
    id: `Y-${bill.id}`,
    createdAt: new Date().toISOString(),
    billId: bill.id,
    consultId: bill.consultId,
    registrationId: bill.registrationId,
    chartId: bill.chartId,
    patientLabel: bill.patientLabel,
    formulaName: bill.formulaName,
    doses: 3,
    lines: (formula?.herbs ?? []).map((h) => ({ name: h.name, classic: h.classic, grams: parseGrams(h.modern) })),
    allergy,
    pregnancy,
    child,
    status: "待审方",
    reviewNote: "",
    flags: [],
    decoct,
    pickupAt: "",
    deliverTo: "",
  };
}
