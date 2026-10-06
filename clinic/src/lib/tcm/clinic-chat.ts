import { createServerFn } from "@tanstack/react-start";
import type { ChatTurn, Intake, Patient } from "./types";

export type ChatContext = {
  role: "医师" | "助手";
  patient: Pick<Patient, "name" | "age" | "sex" | "visitDate">;
  intake: Intake;
  formulaNames: string[];
  eight: string[];
  billHint: string;
};

export const chatWithClinic = createServerFn({ method: "POST" })
  .validator((input: { messages: ChatTurn[]; context: ChatContext }) => input)
  .handler(async ({ data }): Promise<{ ok: boolean; text: string; error?: string }> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, text: "", error: "对话暂不可用" };
    if (!data.messages.length) return { ok: false, text: "", error: "请输入问题" };

    const ctx = data.context;
    const sys = `你是「经方诊室」执业辅助对话。当前操作者角色：${ctx.role}。
必须结合下面病历上下文回答，不要假装已经面诊。
禁止：对患者给出可自行购药的处方、毒性药新剂量、针灸操作步骤、替代放射/检验正式报告。
${ctx.role === "助手" ? "助手只能帮助采集与解释字段，不能核定方剂。" : "医师可讨论方证草稿，须提醒面诊复核。"}
急症只提醒急救。简体中文，尽量 120–280 字。

【当前病历】
姓名 ${ctx.patient.name || "未填"} ${ctx.patient.sex} ${ctx.patient.age ? ctx.patient.age + "岁" : ""} 日期 ${ctx.patient.visitDate}
主诉 ${ctx.intake.chief || "未填"} 起病 ${ctx.intake.onset}
寒热 ${ctx.intake.coldHeat} 汗 ${ctx.intake.sweat} 大便 ${ctx.intake.stool} 小便 ${ctx.intake.urine}
口渴 ${ctx.intake.thirst} 睡眠 ${ctx.intake.sleep} 胸 ${ctx.intake.chest} 腹 ${ctx.intake.abdomen}
痛 ${ctx.intake.pain} 脉 ${ctx.intake.pulse} 舌 ${ctx.intake.tongue}
孕 ${ctx.intake.pregnancy ? "是" : "否"} 小儿 ${ctx.intake.child ? "是" : "否"}
八纲 ${ctx.eight.join("、") || "尚未辨证"}
候选方 ${ctx.formulaNames.join("、") || "无"}
收费 ${ctx.billHint || "无"}`;

    const recent = data.messages.slice(-10);
    const messages = [
      { role: "system" as const, content: sys },
      ...recent.map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.text.slice(0, 800),
      })),
    ];

    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          max_tokens: 500,
          temperature: 0.3,
          messages,
        }),
      });
      if (!res.ok) return { ok: false, text: "", error: `模型接口 ${res.status}` };
      const body = (await res.json()) as { choices: { message: { content: string } }[] };
      return { ok: true, text: (body.choices[0]?.message.content ?? "").trim() };
    } catch {
      return { ok: false, text: "", error: "网络异常" };
    }
  });
