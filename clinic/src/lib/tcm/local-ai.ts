import type { ChatTurn, Intake, LocalAi, Patient } from "./types";

export type ClinicChatPayload = {
  messages: ChatTurn[];
  context: {
    role: "医师" | "助手";
    patient: Pick<Patient, "name" | "age" | "sex" | "visitDate">;
    intake: Intake;
    formulaNames: string[];
    eight: string[];
    billHint: string;
  };
  image?: string;
};

export function clinicSystemPrompt(ctx: ClinicChatPayload["context"]) {
  return `你是「经方诊室」里的 AI 医生，卡通形象的执业辅助助手，自称「AI 医生」。当前操作者：${ctx.role}。
语气亲切、简短、像诊室里的年轻医师，但必须严肃对待安全。
必须结合病历上下文。禁止确诊、禁止让患者自行购药、禁止毒性药新剂量与针灸操作。
${ctx.role === "助手" ? "助手场景只帮助采集与解释，不能核定方剂。" : "可与医师讨论方证草稿，须提醒面诊复核。"}
若用户发了照片：描述可见内容（舌象、化验单、药袋等），不能替代正式报告。急症只提醒急救。
简体中文，120–280 字。结尾可加一句：请执业医师复核。

【当前病历】
姓名 ${ctx.patient.name || "未填"} ${ctx.patient.sex} ${ctx.patient.age ? ctx.patient.age + "岁" : ""} ${ctx.patient.visitDate}
主诉 ${ctx.intake.chief || "未填"} 寒热 ${ctx.intake.coldHeat} 汗 ${ctx.intake.sweat}
二便 ${ctx.intake.stool}/${ctx.intake.urine} 舌 ${ctx.intake.tongue} 脉 ${ctx.intake.pulse}
八纲 ${ctx.eight.join("、") || "尚未辨证"} 候选方 ${ctx.formulaNames.join("、") || "无"}
收费 ${ctx.billHint || "无"}`;
}

export async function chatLocal(local: LocalAi, payload: ClinicChatPayload): Promise<{ ok: boolean; text: string; error?: string }> {
  const base = local.baseUrl.replace(/\/$/, "");
  const recent = payload.messages.slice(-10);
  const last = recent[recent.length - 1];
  const content = payload.image
    ? [
        { type: "text", text: last?.text || "请看这张图，结合当前病历说明。" },
        { type: "image_url", image_url: { url: payload.image, detail: "low" } },
      ]
    : last?.text || "";

  const messages = [
    { role: "system", content: clinicSystemPrompt(payload.context) },
    ...recent.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.text.slice(0, 800),
    })),
    { role: "user", content },
  ];

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: local.model || "qwen2.5",
        max_tokens: 500,
        temperature: 0.3,
        messages,
      }),
    });
    if (!res.ok) return { ok: false, text: "", error: `本机模型 ${res.status}，请确认 Ollama 已开并允许跨域` };
    const body = (await res.json()) as { choices: { message: { content: string } }[] };
    return { ok: true, text: (body.choices[0]?.message.content ?? "").trim() };
  } catch {
    return { ok: false, text: "", error: "连不上本机模型。请在诊所电脑启动 Ollama，并填写正确地址。" };
  }
}
