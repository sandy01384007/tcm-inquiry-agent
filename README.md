# 经方问询助手 / 经方诊室

中医小诊所 **理论 Skill + 诊所问诊 App**。

**不是自动医生。** 方证、煎煮、西药对症、舌象与检验解读，均供具备资质的执业中医师作草稿，须面诊复核。

## 仓库结构

```
tcm-inquiry-agent/
├── SKILL.md                 # Grok Skill 主指令
├── README.md
├── assets/glossary.json
├── scripts/                 # RAG 切分、风险过滤
├── references/              # Prompt、安装、测试、视觉模型说明
└── clinic/                  # 诊所 App 源码（TanStack Start）
    ├── src/lib/tcm/         # 经方、煎煮、匹配、舌象/检验 AI
    ├── src/routes/          # 看诊、方库、检验、记录
    └── src/components/      # 舌象拍照、诊室壳
```

## 诊所 App 已完善

- 患者：姓名、年龄、性别、就诊日期、编号
- 辨证出方：八纲/六经标签匹配，经方候选 + 详细煎煮步骤
- 西药对症：仅医师核定后可见的 OTC 类草稿
- 舌象：拍照 / 上传 + **视觉大模型**质控（须医师目视复核）
- 检验影像：体检报告、化验单、CT（最多 3 张）+ AI 摘录（非正式报告）
- 医师 / 助手权限：助手不能核定处方
- 急症拦截；附子、承气等峻剂不给出家庭克数

## 视觉模型怎么接

舌象与 CT **不是**导入 `.gguf` 文件，而是调用**带视觉的大模型（VLM）**。

诊所 App 默认：`grok-4.5`，服务端 `POST https://api.x.ai/v1/chat/completions`，消息含 `image_url`（压缩后的 JPEG data URL）。密钥只用环境变量 `XAI_API_KEY`，禁止写进前端。

详见 `references/vision-models.md`。

## Skill 安装

```bash
mkdir -p ~/.grok/skills/tcm-inquiry-agent
cp -r SKILL.md assets scripts references ~/.grok/skills/tcm-inquiry-agent/
```

本仓库**不含**受版权保护的完整课程讲稿。诊所应使用自有、已获授权的蒸馏笔记作 RAG。

## License

MIT
