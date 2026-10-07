# 方库更新与本地模型

## 知识

1. 方库 → 导入 JSON（见 `clinic/public/formulas.example.json`）
2. 或把方剂写入 `clinic/public/formulas.local.json`，点「加载本地文件」
3. 可手工加一首「本店」方

同 id 覆盖内置方。高风险方仍不出家庭克数。

## 本机模型

诊所电脑安装 [Ollama](https://ollama.com)，例如 `ollama pull qwen2.5`。方库页勾选「使用本机模型」，地址默认 `http://127.0.0.1:11434/v1`。看图用 `llava` 等视觉模型。

未勾选时 AI 医生走云端 Grok。
