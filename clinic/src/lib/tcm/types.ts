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
  chartId: string;
  registrationId: string;
  phone: string;
  allergy: string;
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
  chartId: "",
  registrationId: "",
  phone: "",
  allergy: "",
};

export type Chart = {
  id: string;
  name: string;
  sex: string;
  age: string;
  phone: string;
  idNo: string;
  allergy: string;
  history: string;
  chronic: string;
  createdAt: string;
  updatedAt: string;
};

export type RegKind = "现场" | "预约";
export type RegStatus = "候诊" | "就诊中" | "已完诊" | "已退号";

export type Registration = {
  id: string;
  chartId: string;
  patientLabel: string;
  seq: number;
  visitDate: string;
  appointAt: string;
  kind: RegKind;
  feeFen: number;
  method: PayMethod;
  paid: boolean;
  status: RegStatus;
  createdAt: string;
  consultId?: string;
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

export type PayMethod = "微信" | "支付宝" | "现金";

export const PAY_METHODS: PayMethod[] = ["微信", "支付宝", "现金"];

export type PayStatus = "待收" | "已收" | "作废";

export type FeeSchedule = {
  consultFen: number;
  herbFen: number;
  decoctFen: number;
  regFen: number;
};

export const DEFAULT_FEES: FeeSchedule = {
  consultFen: 5000,
  herbFen: 0,
  decoctFen: 1000,
  regFen: 1000,
};

export type BillItemKind = "挂号" | "诊金" | "中药" | "西药" | "代煎" | "其他";

export type BillItem = {
  name: string;
  amountFen: number;
  kind?: BillItemKind;
  qty?: number;
};

export type Bill = {
  id: string;
  createdAt: string;
  paidAt?: string;
  patientLabel: string;
  consultId?: string;
  formulaName?: string;
  chartId?: string;
  registrationId?: string;
  rxId?: string;
  items: BillItem[];
  method: PayMethod;
  status: PayStatus;
  note: string;
};

export type PayCodes = {
  wechat: string;
  alipay: string;
};

export const EMPTY_PAY_CODES: PayCodes = { wechat: "", alipay: "" };

export type BillDraft = {
  consultId?: string;
  formulaName?: string;
  items: BillItem[];
};

export type ChatTurn = {
  role: "user" | "assistant";
  text: string;
  at: string;
  image?: string;
};

export type LocalAi = {
  enabled: boolean;
  baseUrl: string;
  model: string;
};

export const EMPTY_LOCAL_AI: LocalAi = {
  enabled: false,
  baseUrl: "http://127.0.0.1:11434/v1",
  model: "qwen2.5",
};

export type VisitKind = "门诊普通" | "急诊" | "术后" | "慢病";

export const VISIT_KINDS: VisitKind[] = ["门诊普通", "急诊", "术后", "慢病"];

export type FollowRisk = "正常" | "关注" | "高危";

export type FollowStatus = "待打卡" | "已提交" | "已回访" | "失联归档" | "已归档";

export type SymptomTrend = "好转" | "无变化" | "加重";

export type MedAdherence = "按时服用" | "漏服" | "停药" | "过敏不适";

export type RecheckProgress = "未做" | "已完成";

export type FollowRule = {
  kind: VisitKind;
  delayHours: number;
};

export type FollowConfig = {
  rules: FollowRule[];
  extraPrompt: string;
  emergencyWords: string[];
  questions: string[];
};

export const FOLLOW_DELAYS = [24, 48, 72, 168] as const;

export const DEFAULT_FOLLOW_RULES: FollowRule[] = [
  { kind: "门诊普通", delayHours: 24 },
  { kind: "急诊", delayHours: 24 },
  { kind: "术后", delayHours: 48 },
  { kind: "慢病", delayHours: 168 },
];

export const DEFAULT_FOLLOW_WORDS = [
  "胸痛",
  "呼吸困难",
  "喘不过气",
  "大出血",
  "呕血",
  "昏迷",
  "抽搐",
  "剧痛",
  "持续高热",
  "高热不退",
  "意识不清",
];

export const EMPTY_FOLLOW_CONFIG: FollowConfig = {
  rules: DEFAULT_FOLLOW_RULES,
  extraPrompt: "",
  emergencyWords: DEFAULT_FOLLOW_WORDS,
  questions: [],
};

export type FollowCheckin = {
  trend: SymptomTrend | "";
  med: MedAdherence | "";
  newDiscomfort: string;
  recheck: RecheckProgress | "";
  recheckNote: string;
  reportImage?: string;
  message: string;
  answers?: string[];
  submittedAt: string;
};

export type FollowTask = {
  id: string;
  createdAt: string;
  dueAt: string;
  patientLabel: string;
  consultId?: string;
  billId?: string;
  visitKind: VisitKind;
  risk: FollowRisk;
  status: FollowStatus;
  recheckDate: string;
  recheckItems: string;
  checkin?: FollowCheckin;
  robotLog?: { role: "robot" | "patient"; text: string }[];
  staffNote: string;
};

export type StockMoveKind = "入库" | "出库" | "发药" | "损耗";

export type WestUnit = "盒" | "瓶" | "板" | "支";

export type WestStockItem = {
  name: string;
  spec: string;
  unit: WestUnit;
  qty: number;
  warnAt: number;
  batch: string;
  expiry: string;
  priceFen: number;
};

export type WestMove = {
  id: string;
  at: string;
  name: string;
  kind: StockMoveKind;
  qty: number;
  note: string;
  billId?: string;
};

export type WestRxStatus = "草稿" | "已签" | "已收费" | "已发" | "作废";

export type WestRxLine = {
  name: string;
  qty: number;
  usage: string;
};

export type WestRx = {
  id: string;
  createdAt: string;
  signedAt?: string;
  printedAt?: string;
  chartId: string;
  registrationId: string;
  consultId?: string;
  billId?: string;
  patientLabel: string;
  allergy: string;
  pregnancy: boolean;
  child: boolean;
  impression: string;
  doctorSign: string;
  pharmacistSign: string;
  lines: WestRxLine[];
  status: WestRxStatus;
};

export type WestOrder = {
  id: string;
  billId: string;
  patientLabel: string;
  chartId?: string;
  registrationId?: string;
  allergy: string;
  createdAt: string;
  status: "待核" | "已发" | "退回";
  lines: { name: string; qty: number }[];
  note: string;
};

export type StockItem = {
  name: string;
  qty: number;
  warnAt: number;
};

export type StockMove = {
  id: string;
  at: string;
  name: string;
  kind: StockMoveKind;
  qty: number;
  note: string;
  dispenseId?: string;
};

export type DispenseStatus = "待审方" | "已审方" | "已配药" | "已发药" | "退回";

export type DispenseLine = {
  name: string;
  classic: string;
  grams: number;
};

export type ReviewFlag = {
  level: "通过" | "关注" | "拦截";
  text: string;
};

export type DispenseOrder = {
  id: string;
  createdAt: string;
  billId: string;
  consultId?: string;
  registrationId?: string;
  chartId?: string;
  patientLabel: string;
  formulaName: string;
  doses: number;
  lines: DispenseLine[];
  allergy: string;
  pregnancy: boolean;
  child: boolean;
  status: DispenseStatus;
  reviewNote: string;
  flags: ReviewFlag[];
  reviewedAt?: string;
  dispensedAt?: string;
  decoct: boolean;
  pickupAt: string;
  deliverTo: string;
};

export const CHANNELS: Channel[] = ["太阳", "阳明", "少阳", "太阴", "少阴", "厥阴", "杂病"];

export const RISKS: Risk[] = ["low", "medium", "high", "critical"];
