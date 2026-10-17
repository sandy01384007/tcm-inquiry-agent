import type { Chart, Registration } from "./types";

export function digits(value: string) {
  return value.replace(/\D/g, "");
}

export function maskId(idNo: string) {
  const d = digits(idNo);
  if (d.length < 4) return "";
  return `${"*".repeat(Math.min(14, d.length - 4))}${d.slice(-4)}`;
}

export function findChart(charts: Chart[], phone: string, idNo: string) {
  const p = digits(phone);
  const id = digits(idNo);
  if (p.length < 6 && id.length < 6) return undefined;
  return charts.find(
    (c) => (p.length >= 6 && digits(c.phone) === p) || (id.length >= 6 && digits(c.idNo) === id),
  );
}

export function nextSeq(list: Registration[], visitDate: string) {
  const seqs = list.filter((r) => r.visitDate === visitDate && r.status !== "已退号").map((r) => r.seq);
  return (seqs.length ? Math.max(...seqs) : 0) + 1;
}

export function openTicket(list: Registration[], chartId: string, visitDate: string) {
  return list.find(
    (r) => r.chartId === chartId && r.visitDate === visitDate && (r.status === "候诊" || r.status === "就诊中"),
  );
}
