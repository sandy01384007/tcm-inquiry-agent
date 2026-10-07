import { FORMULAS } from "./formulas";
import type { Formula, Intake, Match } from "./types";

function bag(intake: Intake): string {
  return [
    intake.chief,
    intake.coldHeat,
    intake.sweat,
    intake.stool,
    intake.urine,
    intake.thirst,
    intake.sleep,
    intake.chest,
    intake.abdomen,
    intake.pain,
    intake.pulse,
    intake.tongue,
  ]
    .join(" ")
    .replace(/\s+/g, "");
}

export function eightPrinciples(intake: Intake): string[] {
  const t = bag(intake);
  const out: string[] = [];
  if (["恶寒重", "但寒不热", "手足冷", "恶寒"].some((x) => t.includes(x))) out.push("寒");
  if (["发热重", "但热不寒", "往来寒热", "壮热", "发热"].some((x) => t.includes(x))) out.push("热");
  if (intake.sweat === "无汗" || t.includes("恶寒") || t.includes("脉浮")) out.push("表");
  if (["便秘硬结", "腹满痛拒按", "潮热", "但热不寒"].some((x) => t.includes(x))) out.push("里");
  if (["下利清谷", "乏力", "气短", "但欲寐", "脉微"].some((x) => t.includes(x))) out.push("虚");
  if (["腹满痛拒按", "便秘硬结", "痰", "痞"].some((x) => t.includes(x))) out.push("实");
  if (out.includes("寒") && out.includes("虚")) out.push("阴");
  if (out.includes("热") && out.includes("实")) out.push("阳");
  return [...new Set(out)];
}

export function matchFormulas(intake: Intake, catalog: Formula[] = FORMULAS): Match[] {
  const text = bag(intake);
  const extras = [
    intake.coldHeat,
    intake.sweat,
    intake.stool,
    intake.thirst,
    intake.sleep,
    intake.chest,
    intake.abdomen,
  ].filter(Boolean);

  const matches: Match[] = catalog.map((formula) => {
    const reasons: string[] = [];
    let score = 0;
    for (const tag of formula.tags) {
      const hit =
        text.includes(tag) || extras.some((e) => e.includes(tag) || tag.includes(e));
      if (hit) {
        score += tag.length >= 3 ? 4 : 2;
        reasons.push(tag);
      }
    }
    if (intake.pulse && formula.tags.some((t) => intake.pulse.includes(t.replace("脉", "")))) {
      score += 2;
    }
    if (intake.pregnancy && formula.risk !== "low") score -= 10;
    if (intake.child && (formula.risk === "high" || formula.risk === "critical")) score -= 10;
    if ((formula.risk === "critical" || formula.risk === "high") && reasons.length < 2) {
      score = 0;
    }
    return { formula, score, reasons: [...new Set(reasons)].slice(0, 6) };
  })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return matches;
}

export function canShowModernDose(
  intake: Intake,
  risk: Match["formula"]["risk"],
  hide: boolean,
) {
  if (hide) return false;
  if (intake.pregnancy || intake.child) return risk === "low";
  if (risk === "critical") return false;
  return true;
}

export function localExplain(intake: Intake, names: string[], principles: string[]): string {
  const lines = [
    `主诉「${intake.chief || "未写"}」。`,
    principles.length ? `八纲倾向：${principles.join("、")}。` : "八纲信息不足，建议补寒热、汗、二便。",
    intake.coldHeat ? `寒热：${intake.coldHeat}。` : "",
    intake.sweat ? `汗：${intake.sweat}。` : "",
    names.length
      ? `规则引擎按症状标签匹配到候选经方：${names.join("、")} 。此为方证索引草稿，不是确诊，也不是可直接照服的处方。`
      : "尚无足够标签匹配经方，请补充脉舌与二便。",
    "含附子、硝黄、细辛等药的方剂，剂量必须由执业中医师面诊后亲自核定。",
  ];
  return lines.filter(Boolean).join("");
}
