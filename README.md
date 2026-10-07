# 经方问询助手 / 经方诊室

中医小诊所 **理论 Skill + 诊所问诊 App**。

**不是自动医生。** 方证、煎煮、西药对症、舌象与检验解读、收费与 **AI 医生** 对话，均供执业中医师作草稿，须面诊复核。

## 今日两块

1. **方库可更新 / 本地部署**
   - 导入/导出 JSON、手工增补
   - `clinic/public/formulas.local.json` 或 `formulas.example.json`
   - 方库页可连本机 Ollama（`http://127.0.0.1:11434/v1`）
2. **AI 医生**
   - 卡通医生形象，名称红字
   - 打字、语音、拍照、上传图片；可朗读回复
   - 自动带入当前病历

详见 `references/local-library.md`。

## License

MIT
