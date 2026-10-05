export type Risk = "low" | "medium" | "high" | "critical";

export type Channel =
  | "太阳"
  | "阳明"
  | "少阳"
  | "太阴"
  | "少阴"
  | "厥阴"
  | "杂病";

export type Herb = {
  name: string;
  classic: string;
  modern?: string;
};

export type Decoction = {
  fire: string;
  water: string;
  soak: string;
  classic: string;
  steps: string[];
  take: string;
  note: string;
  restricted: boolean;
};

export type WesternHint = {
  id: string;
  name: string;
  cls: string;
  when: string;
  caution: string;
  typical?: string;
  tags: string[];
};

export type Formula = {
  id: string;
  name: string;
  pinyin: string;
  source: string;
  channel: Channel;
  pattern: string;
  indication: string;
  herbs: Herb[];
  usage: string;
  caution: string;
  risk: Risk;
  hideModernDose: boolean;
  tags: string[];
};

export type Patient = {
  ref: string;
  name: string;
  age: string;
  sex: string;
  visitDate: string;
};

export function todayDate() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export const EMPTY_PATIENT: Patient = {
  ref: "",
  name: "",
  age: "",
  sex: "",
  visitDate: "",
};

export const SEX_OPTIONS = ["", "男", "女"] as const;

export type Intake = {
  chief: string;
  onset: string;
  coldHeat: string;
  sweat: string;
  stool: string;
  urine: string;
  thirst: string;
  sleep: string;
  chest: string;
  abdomen: string;
  pain: string;
  pulse: string;
  tongue: string;
  tongueAiNote?: string;
  tongueVerified?: boolean;
  pregnancy: boolean;
  child: boolean;
};

export type Match = {
  formula: Formula;
  score: number;
  reasons: string[];
};

export type ConsultRecord = {
  id: string;
  createdAt: string;
  patient: Patient;
  intake: Intake;
  matches: Match[];
  eightPrinciples: string[];
  confirmed: boolean;
  note: string;
};

export const EMPTY_INTAKE: Intake = {
  chief: "",
  onset: "",
  coldHeat: "",
  sweat: "",
  stool: "",
  urine: "",
  thirst: "",
  sleep: "",
  chest: "",
  abdomen: "",
  pain: "",
  pulse: "",
  tongue: "",
  tongueAiNote: "",
  tongueVerified: false,
  pregnancy: false,
  child: false,
};

export type ImagingKind = "体检报告" | "CT" | "化验单" | "其他";

export const IMAGING_KINDS: ImagingKind[] = ["体检报告", "CT", "化验单", "其他"];

export type ImagingReport = {
  id: string;
  kind: ImagingKind;
  patientLabel: string;
  createdAt: string;
  valid: boolean;
  urgent: boolean;
  title: string;
  findings: string[];
  flags: string[];
  tcmHint: string;
  note: string;
};
