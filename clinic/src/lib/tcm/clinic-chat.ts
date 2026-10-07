import { createServerFn } from "@tanstack/react-start";
import { clinicSystemPrompt, type ClinicChatPayload } from "./local-ai";

export const chatWithClinic = createServerFn({ method: "POST" })
  .validator((input: ClinicChatPayload) => input)
  .handler(async ({ data }): Promise<{ ok: boolean; text: string; error?: string }> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, text: "", error: "对话暂不可用" };
    if (!data.messages.length && !data.image) return { ok: false, text: "", error: "请输入问题或上传图片" };

    const recent = data.messages.slice(-10);
    const last = recent[recent.length - 1];
    const userContent = data.image
      ? [
          { type: "text" as const, text: last?.text || "请看这张图，结合当前病历说明。" },
          { type: "image_url" as const, image_url: { url: data.image, detail: "low" as const } },
        ]
      : last?.text || "";

    const messages = [
      { role: "system" as const, content: clinicSystemPrompt(data.context) },
      ...recent.slice(0, data.image ? -1 : undefined).map((m) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
        content: m.text.slice(0, 800),
      })),
      ...(data.image ? [{ role: "user" as const, content: userContent }] : []),
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
