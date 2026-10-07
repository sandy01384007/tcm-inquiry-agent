# 经方诊室 App

## 今日更新

- `src/routes/library.tsx` 方库导入/本店增补/本机模型
- `src/lib/tcm/catalog.ts` JSON 合并
- `src/lib/tcm/local-ai.ts` 本机 Ollama
- `src/components/clinic-chat.tsx` + `ai-doctor.tsx` AI 医生（语音/拍照/上传）
- `public/formulas.local.json` 本地方库位

看诊使用 `mergeFormulas(extraFormulas)` 后再匹配。
