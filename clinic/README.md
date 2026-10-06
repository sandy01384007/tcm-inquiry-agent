# 经方诊室 App 源码

## 本次更新

- `src/routes/billing.tsx` 收费台：微信 / 支付宝收款码、现金、账单
- `src/lib/tcm/money.ts` 分/元
- `src/lib/tcm/clinic-chat.ts` 带病历上下文的多轮对话
- `src/components/clinic-chat.tsx` 右下角「问 AI」窗

看诊页「去收费」会带入患者与方名。AI 会带入主诉、八纲、候选方与待收金额。
