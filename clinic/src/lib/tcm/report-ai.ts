import { createServerFn } from "@tanstack/react-start";
import type { ImagingKind } from "./types";

export type ReportAiResult = {
  ok: boolean;
  valid: boolean;
  urgent: boolean;
  title: string;
  findings: string[];
  flags: string[];
  tcmHint: string;
  note: string;
  error?: string;
};

export const analyzeReport = createServerFn({ method: "POST" })
  .validator((input: { kind: ImagingKind; images: string[] }) => input)
  .handler(async ({ data }): Promise<ReportAiResult> => {
    const apiKey = process.env.XAI_API_KEY;
    const fail = (error: string): ReportAiResult => ({
      ok: false,
      valid: false,
      urgent: false,
      title: "",
      findings: [],
      flags: [],
      tcmHint: "",
      note: "",
      error,
    });
    if (!apiKey) return fail("AI 解读暂不可用");
    if (!data.images.length || data.images.length > 3) return fail("请上传 1–3 张图片");
    if (data.images.some((img) => !img.startsWith("data:image/") || img.length > 900_000)) {
      return fail("图片过大或格式不支持");
    }

    const sys = `你是诊所执业医师的检验/影像质控助手。用户声明材料类型为「${data.kind}」。
任务：判断图片是否像该类型；摘录可见文字或影像所见；标出需人工复核的异常提示。
严禁：确诊、分期、替代放射科/检验科正式报告、给出处方或让患者自行用药。
若为急症线索（大出血、张力性气胸、明显脑出血等）设 urgent=true，并写明须立即专科处理。
只输出 JSON：
{"valid":true或false,"urgent":false,"title":"一句话摘要","findings":["所见1"],"flags":["需关注1"],"tcmHint":"可与寒热虚实对照的一句提示，不要开方","note":"局限与建议复核"}`;

    const content: Array<Record<string, unknown>> = [
      {
        type: "text",
        text: `请解读这组「${data.kind}」照片。材料类型若不匹配，valid=false。`,
      },
      ...data.images.map((url) => ({
        type: "image_url",
        image_url: {
          url,
          detail: data.kind === "CT" ? "low" : "high",
        },
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
          max_tokens: 700,
          temperature: 0.2,
          messages: [
            { role: "system", content: sys },
            { role: "user", content },
          ],
        }),
      });
      if (!res.ok) return fail(`模型接口 ${res.status}`);
      const body = (await res.json()) as {
        choices: { message: { content: string } }[];
      };
      const raw = (body.choices[0]?.message.content ?? "").replace(/```json|```/g, "");
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<ReportAiResult>;
      const list = (v: unknown) =>
        Array.isArray(v) ? v.map((x) => String(x).slice(0, 80)).slice(0, 8) : [];
      return {
        ok: true,
        valid: Boolean(parsed.valid),
        urgent: Boolean(parsed.urgent),
        title: String(parsed.title ?? "").slice(0, 60),
        findings: list(parsed.findings),
        flags: list(parsed.flags),
        tcmHint: String(parsed.tcmHint ?? "").slice(0, 80),
        note: String(parsed.note ?? "").slice(0, 160),
      };
    } catch {
      return fail("解读失败，请换清晰原件重拍");
    }
  });
