# 经方诊室 App

## 昨日：方库与 AI 医生

- 方库可导入 / 导出 / 本店增补，`public/formulas.local.json`
- 可接本机 Ollama（方库页勾选）
- AI 医生：语音、拍照、上传图片，名称红色，回复正文深色

## 今日：界面与形象

- 全站改为参考页风格：深松绿顶栏、鲜绿标题与胶囊按钮、白卡片、Noto Sans SC + Outfit
- AI 医生换成立体卡通男医生（无小熊），按钮与标题循环眨眼点头
- 素材：`public/ai-doctor.mp4`、`public/ai-doctor.jpg`

看诊匹配请用 `mergeFormulas(extraFormulas)` 后再调用 `matchFormulas(intake, catalog)`。
