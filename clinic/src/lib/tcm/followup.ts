import {
  DEFAULT_FOLLOW_RULES,
  DEFAULT_FOLLOW_WORDS,
  type FollowCheckin,
  type FollowConfig,
  type FollowRisk,
  type FollowStatus,
  type FollowTask,
  type VisitKind,
} from "./types";

export function delayHours(config: FollowConfig, kind: VisitKind) {
  return config.rules.find((r) => r.kind === kind)?.delayHours ?? DEFAULT_FOLLOW_RULES[0].delayHours;
}

export function dueFrom(fromIso: string, hours: number) {
  return new Date(new Date(fromIso).getTime() + hours * 3600_000).toISOString();
}

export function plusDays(from = new Date(), days: number) {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function isDue(task: FollowTask, now = Date.now()) {
  return new Date(task.dueAt).getTime() <= now;
}

export function hoursPastDue(task: FollowTask, now = Date.now()) {
  return (now - new Date(task.dueAt).getTime()) / 3600_000;
}

export function keywordHits(text: string, words: string[]) {
  return (words.length ? words : DEFAULT_FOLLOW_WORDS).filter((w) => w && text.includes(w));
}

export function recheckDue(task: FollowTask, today: string) {
  return Boolean(task.recheckDate) && task.recheckDate <= today && task.status !== "待打卡" && task.status !== "失联归档";
}

export function classifyFollow(checkin: FollowCheckin, words: string[]): { risk: FollowRisk; status: FollowStatus; hits: string[] } {
  const text = `${checkin.newDiscomfort} ${checkin.message} ${checkin.recheckNote} ${(checkin.answers ?? []).join(" ")}`;
  const hits = keywordHits(text, words);
  if (hits.length || checkin.trend === "加重" || checkin.med === "过敏不适") {
    return { risk: "高危", status: "已提交", hits };
  }
  if (checkin.trend === "无变化" || checkin.med === "漏服" || checkin.med === "停药") {
    return { risk: "关注", status: "已提交", hits };
  }
  return { risk: "正常", status: "已归档", hits };
}

export function followupsToCsv(list: FollowTask[]) {
  const head = ["创建时间", "患者", "类型", "风险", "状态", "症状变化", "用药", "新增不适", "复查", "留言", "补充回答", "医护备注", "复诊日期", "账单"];
  const rows = list.map((t) =>
    [
      t.createdAt,
      t.patientLabel,
      t.visitKind,
      t.risk,
      t.status,
      t.checkin?.trend ?? "",
      t.checkin?.med ?? "",
      t.checkin?.newDiscomfort ?? "",
      t.checkin?.recheck ?? "",
      t.checkin?.message ?? "",
      (t.checkin?.answers ?? []).join("；"),
      t.staffNote,
      t.recheckDate,
      t.billId ?? "",
    ]
      .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
      .join(","),
  );
  return `\uFEFF${head.join(",")}\n${rows.join("\n")}`;
}

export function delayLabel(hours: number) {
  if (hours === 24) return "24小时";
  if (hours === 48) return "48小时";
  if (hours === 72) return "3天";
  if (hours === 168) return "7天";
  return `${hours}小时`;
}
