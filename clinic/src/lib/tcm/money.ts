export function yuan(fen: number) {
  return (Math.max(0, fen) / 100).toFixed(2);
}

export function parseYuan(s: string) {
  const n = Number(s.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function sumFen(items: { amountFen: number }[]) {
  return items.reduce((a, x) => a + Math.max(0, x.amountFen), 0);
}
