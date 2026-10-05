import { createServerFn } from "@tanstack/react-start";

export type TongueAiResult = {
  ok: boolean;
  valid: boolean;
  summary: string;
  quality: string;
  note: string;
  error?: string;
};

export const analyzeTongue = createServerFn({ method: "POST" })
  .validator((input: { image: string }) => input)
  .handler(async ({ data }): Promise<TongueAiResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return {
        ok: false,
        valid: false,
        summary: "",
        quality: "",
        note: "",
        error: "AI 校验暂不可用",
      };
    }
    if (!data.image.startsWith("data:image/") || data.image.length > 900_000) {
      return {
        ok: false,
        valid: false,
        summary: "",
        quality: "",
        note: "",
        error: "图片过大或格式不支持，请重拍",
      };
    }

    const sys = `你是执业中医诊室的舌象质控助手。只根据照片判断：是否为舌面、拍摄是否可用、舌质与舌苔的客观描述。
禁止确诊、禁止开方、禁止给出西医病名当作结论。
只输出 JSON，不要 markdown：
{"valid":true或false,"quality":"可用|过暗|反光|模糊|未伸舌|非舌象","summary":"如淡红舌薄白苔","note":"一句说明"}
valid 仅在清晰可见舌质与舌苔时为 true。summary 不超过 20 字。`;

    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          max_tokens: 280,
          temperature: 0.2,
          messages: [
            { role: "system", content: sys },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "校验这张照片能否用于中医舌诊记录，并给出舌象短语。",
                },
                {
                  type: "image_url",
                  image_url: { url: data.image, detail: "low" },
                },
              ],
            },
          ],
        }),
      });
      if (!res.ok) {
        return {
          ok: false,
          valid: false,
          summary: "",
          quality: "",
          note: "",
          error: `模型接口 ${res.status}`,
        };
      }
      const body = (await res.json()) as {
        choices: { message: { content: string } }[];
      };
      const raw = body.choices[0]?.message.content ?? "";
      const jsonText = raw.replace(/```json|```/g, "").trim();
      const start = jsonText.indexOf("{");
      const end = jsonText.lastIndexOf("}");
      const parsed = JSON.parse(jsonText.slice(start, end + 1)) as {
        valid?: boolean;
        quality?: string;
        summary?: string;
        note?: string;
      };
      return {
        ok: true,
        valid: Boolean(parsed.valid),
        summary: (parsed.summary ?? "").slice(0, 40),
        quality: parsed.quality ?? "",
        note: (parsed.note ?? "").slice(0, 120),
      };
    } catch {
      return {
        ok: false,
        valid: false,
        summary: "",
        quality: "",
        note: "",
        error: "校验失败，请重拍或改用文字记录",
      };
    }
  });
