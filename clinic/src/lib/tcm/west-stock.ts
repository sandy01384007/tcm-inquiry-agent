import type { Bill, WestOrder, WestStockItem } from "./types";

const BANNED = /头孢|阿莫西林|青霉素|左氧|莫西沙星|阿奇霉素|克林霉素|甲硝唑|吗啡|哌替啶|芬太尼|地西泮|安定片|注射|胰岛素|肾上腺素|杜冷丁/;

export function westName(raw: string) {
  return raw.replace(/^西药\s*/, "").trim();
}

export function bannedWest(name: string) {
  return BANNED.test(name);
}

export function westLines(bill: Bill) {
  return bill.items
    .filter((item) => item.kind === "西药" || item.name.startsWith("西药"))
    .map((item) => ({ name: westName(item.name), qty: Math.max(1, Math.round(item.qty ?? 1)) }))
    .filter((line) => line.name);
}

export function expiryState(expiry: string) {
  if (!expiry) return "none" as const;
  const t = new Date(`${expiry}T23:59:59`).getTime();
  if (Number.isNaN(t)) return "none" as const;
  if (t < Date.now()) return "expired" as const;
  if (t - Date.now() < 90 * 86400000) return "near" as const;
  return "ok" as const;
}

export function reservedWest(orders: { status: string; lines: { name: string; qty: number }[] }[], name: string) {
  return orders
    .filter((order) => order.status === "待核")
    .reduce((sum, order) => sum + (order.lines.find((line) => line.name === name)?.qty ?? 0), 0);
}

export function availableWest(stock: WestStockItem[], orders: { status: string; lines: { name: string; qty: number }[] }[], name: string) {
  const item = stock.find((row) => row.name === name);
  if (!item || expiryState(item.expiry) === "expired") return 0;
  return Math.max(0, item.qty - reservedWest(orders, name));
}

export function orderFromWestBill(bill: Bill, allergy: string): WestOrder | null {
  if (bill.status !== "已收") return null;
  const lines = westLines(bill);
  if (!lines.length) return null;
  return {
    id: `X-${bill.id}`,
    billId: bill.id,
    patientLabel: bill.patientLabel,
    chartId: bill.chartId,
    registrationId: bill.registrationId,
    allergy,
    createdAt: new Date().toISOString(),
    status: "待核",
    lines,
    note: "",
  };
}
