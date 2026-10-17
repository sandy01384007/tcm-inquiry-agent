import type { Intake, WesternHint } from "./types";

export const WESTERN: WesternHint[] = [
  {
    id: "acetaminophen",
    name: "对乙酰氨基酚",
    cls: "解热镇痛",
    when: "发热、头痛、周身酸痛，排除急腹症与严重肝病后，可由有处方权的医师作对症草稿。",
    typical: "须按批准说明书与体重核定，本系统不自动给出儿童剂量。",
    caution: "肝病、酗酒、同服其他含对乙酰氨基酚制剂者禁用或减量。超量可致肝衰竭。",
    tags: ["发热", "发热重", "壮热", "头痛", "身痛", "恶寒"],
  },
  {
    id: "ibuprofen",
    name: "布洛芬",
    cls: "NSAIDs",
    when: "肌肉关节痛、非出血性发热，无活动性溃疡与肾功能明显异常。",
    typical: "餐后服用。剂量由医师按说明书核定。",
    caution: "孕妇晚期、消化道溃疡、肾功能不全、哮喘 NSAID 敏感者禁用。不可与抗凝药随意联用。",
    tags: ["身痛", "头痛", "发热", "项强"],
  },
  {
    id: "ors",
    name: "口服补液盐（ORS）",
    cls: "液体复苏辅助",
    when: "泄泻、热利但神清、能口服、无休克。",
    typical: "按袋装说明兑温开水，少量频服。",
    caution: "频繁呕吐、意识改变、少尿、便血须静脉补液并就医，不可只口服。",
    tags: ["泄泻", "下利", "下利脓血", "热结旁流"],
  },
  {
    id: "loratadine",
    name: "氯雷他定",
    cls: "第二代抗组胺",
    when: "喷嚏流涕、皮肤瘙痒等过敏倾向，非急喘。",
    typical: "按说明书，肝功能异常须医师调整。",
    caution: "急性喉头水肿、呼吸困难须急救，不可用抗组胺代替。",
    tags: ["喷嚏", "过敏", "皮疹", "鼻塞"],
  },
  {
    id: "omeprazole",
    name: "奥美拉唑",
    cls: "PPI（抑酸）",
    when: "胃脘灼热、反酸，已排除急腹症穿孔。",
    typical: "晨起空腹。疗程由医师定。",
    caution: "呕血、黑便、剧烈腹痛须急诊。长期使用须评估。",
    tags: ["反酸", "胃脘", "心下痞", "嘈杂"],
  },
  {
    id: "oral-rehydration-fever",
    name: "物理降温 + 补液指导",
    cls: "支持治疗",
    when: "发热而循环稳定。",
    typical: "温水擦浴、足量饮水。高热不退须急诊。",
    caution: "抽搐、皮疹瘀点、颈项强直须立即就医。",
    tags: ["发热", "壮热", "口渴", "大汗"],
  },
];

export function matchWestern(intake: Intake): WesternHint[] {
  const text = [
    intake.chief,
    intake.coldHeat,
    intake.stool,
    intake.chest,
    intake.abdomen,
    intake.pain,
    intake.thirst,
  ].join("");
  return WESTERN.filter((w) => w.tags.some((t) => text.includes(t))).slice(0, 3);
}
