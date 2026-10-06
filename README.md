# 经方问询助手 / 经方诊室

中医小诊所 **理论 Skill + 诊所问诊 App**。

**不是自动医生。** 方证、煎煮、西药对症、舌象与检验解读、收费与 AI 对话，均供具备资质的执业中医师作草稿，须面诊复核。

## 仓库结构

```
tcm-inquiry-agent/
├── SKILL.md
├── README.md
├── assets/glossary.json
├── scripts/
├── references/
└── clinic/                  # 诊所 App 源码
    ├── src/lib/tcm/         # 经方、煎煮、舌象/检验 AI、收费、对话
    ├── src/routes/          # 看诊、方库、检验、收费、记录
    └── src/components/      # 舌象、诊室壳、AI 对话窗
```

## 诊所 App

- 患者信息与辨证出方（煎煮步骤）
- 舌象拍照 + AI 质控；体检 / CT / 化验单 AI 摘录
- **收费**：微信 / 支付宝收款码 + 现金；看诊可直接「去收费」
- **问 AI**：多轮对话，自动带入当前病历、方证与待收账单
- 医师 / 助手权限；急症拦截

收费说明：当前为诊所收款码入账，**不经手微信/支付宝资金清算**。正式商户 API 需商户号与证书。

视觉模型见 `references/vision-models.md`。

## License

MIT
