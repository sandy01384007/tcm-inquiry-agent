import { bannedWest } from "./west-stock";
import type { BillItem, WestOrder, WestRx, WestStockItem } from "./types";

export function westNeed(items: BillItem[]) {
  return items
    .filter((item) => item.kind === "西药" || item.name.startsWith("西药"))
    .map((item) => ({ name: item.name.replace(/^西药\s*/, "").trim(), qty: Math.max(1, Math.round(item.qty ?? 1)) }))
    .filter((line) => line.name);
}

export function coveringRx(list: WestRx[], chartId: string, items: BillItem[]) {
  const need = westNeed(items);
  if (!need.length || !chartId) return undefined;
  return list.find(
    (rx) =>
      rx.chartId === chartId &&
      (rx.status === "已签" || rx.status === "已收费") &&
      need.every((line) => {
        const hit = rx.lines.find((item) => item.name === line.name);
        return !!hit && hit.qty >= line.qty;
      }),
  );
}

export function rxBlock(rx: WestRx, _stock: WestStockItem[] = [], _orders: WestOrder[] = []) {
  if (!rx.chartId) return "未建档不能签署西药处方";
  if (!(rx.doctorSign ?? "").trim()) return "请先输入医师电脑签名";
  if (!rx.lines.length) return "请至少写一种药品";
  for (const line of rx.lines) {
    if (!(line.usage ?? "").trim()) return `${line.name} 须由医师填写用法，系统不自动给剂量`;
    if (line.qty < 1) return `${line.name} 数量无效`;
    if (bannedWest(line.name)) return `${line.name} 不能开具：不含抗生素、麻醉药品和注射剂`;
    if (rx.allergy && rx.allergy.includes(line.name)) return `过敏史涉及 ${line.name}`;
    if (rx.pregnancy && line.name.includes("布洛芬")) return "妊娠不签布洛芬";
  }
  return "";
}
