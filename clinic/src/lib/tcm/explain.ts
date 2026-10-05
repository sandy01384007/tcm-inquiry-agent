import { createServerFn } from "@tanstack/react-start";
import type { Intake, Match } from "./types";

export const explainPattern = createServerFn({ method: "POST" })
  .validator((input: { intake: Intake; names: string[] }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "AI 解释暂不可用，已显示规则辨证结果。" };
    }

    const sys = `你是中医经方理论助手，只解释八纲/六经框架与候选方证对应关系。
禁止：确诊、增加新处方、给出附子/大黄/细辛等毒性药的新剂量、针灸操作、让患者自行购药服用。
若像急症，只提醒就医。输出简体中文，200-400字。结尾不加客套。`;

    const user = JSON.stringify({
      intake: data.intake,
      candidates: data.names,
    });

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
          messages: [
            { role: "system", content: sys },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) return { ok: false as const, error: `模型接口 ${res.status}` };
      const body = (await res.json()) as {
        choices: { message: { content: string } }[];
      };
      return { ok: true as const, text: body.choices[0]?.message.content ?? "" };
    } catch {
      return { ok: false as const, error: "网络异常，已保留规则辨证。" };
    }
  });

export type MatchLite = Pick<Match, "score" | "reasons">;
