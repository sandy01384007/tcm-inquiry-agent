import type { Chart, ConsultRecord, Patient } from "./types";

const LOOKUP = /病历|看诊记录|既往|上次|以前|病史|调出|调档|查档|过往|旧档|复诊记录/;
const LOAD = /载入最近|打开最近|载入这次|放回看诊/;

export function isRecordQuery(text: string) {
  return LOOKUP.test(text) || LOAD.test(text);
}

export function askedToLoad(text: string) {
  return LOAD.test(text);
}

function maskPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length < 7) return "";
  return `${d.slice(0, 3)}****${d.slice(-4)}`;
}

export function nameInQuery(text: string) {
  const fromVerb = text.match(/(?:调出|调档|查询|查找|查一下)\s*([\u4e00-\u9fa5]{2,4})/);
  const fromOf = text.match(/([\u4e00-\u9fa5]{2,4})的(?:病历|看诊|记录|上次|病史)/);
  const name = fromOf?.[1] || fromVerb?.[1] || "";
  if (!name || /病历|记录|上次|患者|病人|这个|以前/.test(name)) return "";
  return name;
}

export function matchVisits(records: ConsultRecord[], text: string, current: Patient) {
  const name = nameInQuery(text);
  const phone = text.match(/1\d{10}/)?.[0] ?? "";
  const hits = records.filter((r) => {
    const p = r.patient;
    if (phone && p.phone.replace(/\D/g, "").includes(phone)) return true;
    if (name && p.name && (p.name.includes(name) || name.includes(p.name))) return true;
    if (!name && !phone && current.chartId && p.chartId === current.chartId) return true;
    if (!name && !phone && current.name && p.name === current.name) return true;
    return false;
  });
  return { name: name || (!phone ? current.name : ""), hits: hits.slice(0, 6) };
}

export function visitBrief(hits: ConsultRecord[], charts: Chart[], who: string) {
  if (!hits.length) {
    return who
      ? `本机没有「${who}」的看诊记录。请说完整姓名，例如：调出张三的病历。`
      : "请说出患者姓名，例如：调出张三的病历。未找到的记录我不会编造。";
  }
  const chart = charts.find((c) => c.id === hits[0].patient.chartId);
  const head = [
    `${hits[0].patient.name || who || "未署名"}`,
    hits[0].patient.sex,
    hits[0].patient.age ? `${hits[0].patient.age}岁` : "",
    hits[0].patient.chartId ? `档案 ${hits[0].patient.chartId}` : "",
    maskPhone(hits[0].patient.phone || chart?.phone || ""),
  ]
    .filter(Boolean)
    .join(" ");
  const extra = [
    chart?.allergy || hits[0].patient.allergy ? `过敏：${chart?.allergy || hits[0].patient.allergy}` : "",
    chart?.history ? `既往：${chart.history}` : "",
    chart?.chronic ? `慢病：${chart.chronic}` : "",
  ].filter(Boolean);
  const lines = hits.map((r, i) => {
    const when = r.patient.visitDate || r.createdAt.slice(0, 10);
    const formula = r.matches[0]?.formula.name ?? "无方";
    return `${i + 1}. ${when} 主诉 ${r.intake.chief || "未写"}。首选 ${formula}。${r.confirmed ? "已核定" : "未核定"}。`;
  });
  return [`找到 ${hits.length} 次看诊。${head}`, ...extra, ...lines, "要放回看诊页，请说：载入最近一次。"].join("\n");
}
