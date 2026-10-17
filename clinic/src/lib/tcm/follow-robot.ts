import { keywordHits } from "./followup";
import type { FollowCheckin, MedAdherence, RecheckProgress, SymptomTrend } from "./types";

export type RobotLine = { role: "robot" | "patient"; text: string };

type Step = "trend" | "med" | "discomfort" | "recheck" | "question" | "message" | "confirm" | "stop" | "done";

export type RobotState = {
  step: Step;
  qIndex: number;
  name: string;
  recheckItems: string;
  questions: string[];
  trend: SymptomTrend | "";
  med: MedAdherence | "";
  newDiscomfort: string;
  discomfortAsked: boolean;
  recheck: RecheckProgress | "";
  message: string;
  messageAsked: boolean;
  answers: string[];
  hits: string[];
};

export type RobotTurn = {
  state: RobotState;
  say: string;
  choices: string[];
  checkin?: FollowCheckin;
};

const TREND: [SymptomTrend, string[]][] = [
  ["加重", ["加重", "更严重", "恶化", "更疼", "更难受"]],
  ["好转", ["好转", "好点", "好多", "减轻", "轻一些"]],
  ["无变化", ["无变化", "没变化", "一样", "差不多", "还那样"]],
];

const MED: [MedAdherence, string[]][] = [
  ["过敏不适", ["过敏", "皮疹", "药疹", "吃了不舒服"]],
  ["停药", ["停药", "不吃了", "没再吃", "停了"]],
  ["漏服", ["漏服", "忘了", "漏了", "少吃"]],
  ["按时服用", ["按时", "照吃", "每天吃", "都吃了"]],
];

function hit<T extends string>(text: string, table: [T, string[]][]): T | "" {
  for (const [value, words] of table) {
    if (words.some((w) => text.includes(w))) return value;
  }
  return "";
}

function parseRecheck(text: string): RecheckProgress | "" {
  if (["已完成", "已复查", "查过", "做了", "查了"].some((w) => text.includes(w))) return "已完成";
  if (["未做", "没复查", "还没", "没去做", "没做"].some((w) => text.includes(w))) return "未做";
  return "";
}

function none(text: string) {
  return ["没有", "无", "还好", "没问题", "不用"].some((w) => text === w || text.startsWith(w));
}

function questionFor(state: RobotState): { say: string; choices: string[] } {
  if (!state.trend) return { say: "这几天症状是好转、没变化，还是加重？", choices: ["好转", "无变化", "加重"] };
  if (!state.med) return { say: "药是按时吃、漏过、停了，还是吃了不舒服？", choices: ["按时服用", "漏服", "停药", "过敏不适"] };
  if (!state.discomfortAsked) return { say: "有没有新的不舒服？没有就说「没有」。", choices: ["没有新增不适"] };
  if (!state.recheck) return { say: `复查（${state.recheckItems}）做了吗？`, choices: ["未做", "已完成"] };
  if (state.qIndex < state.questions.length) return { say: state.questions[state.qIndex], choices: [] };
  if (!state.messageAsked) return { say: "还有要留给医师的话吗？没有就说「没有」。", choices: ["没有要问的"] };
  return {
    say: `我记下了：症状${state.trend}，用药${state.med}，复查${state.recheck}。确认提交给医护吗？我不能开方或调药。`,
    choices: ["确认提交"],
  };
}

function place(state: RobotState): RobotState {
  let step: Step = "confirm";
  if (!state.trend) step = "trend";
  else if (!state.med) step = "med";
  else if (!state.discomfortAsked) step = "discomfort";
  else if (!state.recheck) step = "recheck";
  else if (state.qIndex < state.questions.length) step = "question";
  else if (!state.messageAsked) step = "message";
  return { ...state, step };
}

function pack(state: RobotState, say: string, choices: string[], checkin?: FollowCheckin): RobotTurn {
  return { state, say, choices, checkin };
}

export function openRobot(name: string, recheckItems: string, questions: string[]): RobotTurn {
  const state = place({
    step: "trend",
    qIndex: 0,
    name,
    recheckItems: recheckItems || "遵医嘱",
    questions: questions.filter(Boolean).slice(0, 3),
    trend: "",
    med: "",
    newDiscomfort: "",
    discomfortAsked: false,
    recheck: "",
    message: "",
    messageAsked: false,
    answers: [],
    hits: [],
  });
  const q = questionFor(state);
  return pack(
    state,
    `${name || "您好"}，我是随访机器人。只记录您现在的情况，不能开方、调药或诊断。急症请直接去医院。${q.say}`,
    q.choices,
  );
}

export function stepRobot(prev: RobotState, raw: string, words: string[]): RobotTurn {
  const text = raw.trim();
  if (!text) return pack(prev, "我没听清，请再说一次，或点下面的选项。", questionFor(prev).choices);
  const hits = keywordHits(text, words);
  if (hits.length) {
    const state: RobotState = { ...prev, step: "stop", hits, newDiscomfort: [prev.newDiscomfort, text].filter(Boolean).join("；") };
    return pack(
      state,
      `听到「${hits.join("、")}」。请立刻去急诊。我停在这里，不能继续问，也不能开方或调药。医护会看到这条记录。`,
      [],
      toCheckin(state),
    );
  }

  let state: RobotState = { ...prev };
  const trend = hit(text, TREND);
  const med = hit(text, MED);
  const recheck = parseRecheck(text);
  if (trend) state.trend = trend;
  if (med) state.med = med;
  if (recheck) state.recheck = recheck;

  if (state.step === "discomfort" || (!state.discomfortAsked && (none(text) || (text.length > 1 && !trend && !med && !recheck)))) {
    state.discomfortAsked = true;
    state.newDiscomfort = none(text) ? "无" : text;
  }
  if (state.step === "question") {
    const answers = [...state.answers];
    answers[state.qIndex] = text;
    state = { ...state, answers, qIndex: state.qIndex + 1 };
  }
  if (state.step === "message") {
    state.messageAsked = true;
    state.message = none(text) || text === "没有要问的" ? "" : text;
  }
  if (state.step === "confirm" && ["确认提交", "确认", "提交", "是"].includes(text)) {
    const done: RobotState = { ...state, step: "done" };
    return pack(done, "已交给医护查看。请按医师当面交代复诊。若突然加重，直接去医院。", [], toCheckin(done));
  }

  state = place(state);
  if (state.step === "discomfort" && state.discomfortAsked) state = place(state);
  const q = questionFor(state);
  return pack(state, q.say, q.choices);
}

function toCheckin(state: RobotState): FollowCheckin {
  return {
    trend: state.trend || (state.hits.length ? "加重" : ""),
    med: state.med,
    newDiscomfort: state.newDiscomfort,
    recheck: state.recheck,
    recheckNote: "",
    message: state.message,
    answers: state.answers,
    submittedAt: new Date().toISOString(),
  };
}
