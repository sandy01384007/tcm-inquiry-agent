# 舌象 / 体检 / CT 应接哪类大模型

## 结论

需要 **视觉语言模型（VLM / multimodal）**，在服务端用 Chat Completions 传图片。  
不要把模型文件导入 App，不要用纯文本 LLM 或只做向量检索的 RAG 读照片。

当前实现：`clinic/src/lib/tcm/tongue-ai.ts`、`clinic/src/lib/tcm/report-ai.ts`  
模型：`grok-4.5`　接口：`https://api.x.ai/v1/chat/completions`

## 能力对照

| 任务 | 能力 | 建议 detail |
|---|---|---|
| 舌象质控 | 是否为舌、光照、舌质舌苔短语 | low |
| 体检/化验单 | OCR + 摘录异常提示 | high |
| CT | 影像所见、急症线索 | low |

## 可用模型类型

适合：Grok 4.x、GPT-4o / 4.1、Claude 3.5+ Sonnet、Qwen-VL、Gemini 等带图接口。  
不适合：纯文本聊天模型、Embedding-only、仅伤寒论文字 RAG。  
本地可选：Qwen2.5-VL + vLLM / Ollama 视觉接口（需 GPU）。

## 接入要点

1. 仅服务端 `fetch`，密钥放环境变量
2. 前端压缩图片（约 768–960px JPEG）再上传
3. 用户点击才调用，禁止页面加载时自动打模型
4. 输出 JSON：质控结果 / 所见摘录 / 需复核项；禁止确诊与开方
5. 不能替代放射科、检验科正式报告
