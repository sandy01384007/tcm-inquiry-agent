const EMERGENCY = [
  "胸痛",
  "胸口痛",
  "心绞痛",
  "呼吸困难",
  "喘不过气",
  "昏迷",
  "休克",
  "大出血",
  "呐血",
  "便血不止",
  "高热不退",
  "抽搞",
  "意识不清",
  "剧烈腹痛",
  "中风",
  "口眼歪斜",
  "半身不遂",
  "自杀",
];

export function detectEmergency(text: string): string[] {
  return EMERGENCY.filter((w) => text.includes(w));
}

export function isEmergencyIntake(chief: string, pain: string): string[] {
  return detectEmergency(`${chief} ${pain}`);
}
