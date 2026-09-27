# 知识库元数据规范

用 `scripts/generate_metadata_csv.py` 生成 CSV。每个文档 / chunk 应携带：

| 字段 | 必填 | 说明 |
|------|------|------|
| file_id | Yes | TCM-001 … TCM-009 |
| title | Yes | 中文标题 |
| domain | Yes | 固定 TCM |
| sub_domain | Yes | 八纲辨证 / 伤寒论 / 针灸 等 |
| doc_type | Yes | course_note / case / glossary |
| language | Yes | zh-CN |
| permission_level | Yes | public / restricted / confidential |
| tags | Yes | 逗号分隔 |
| summary | Yes | ≤100 字 |
| owner | Yes | 知识库管理员 |
| status | Yes | active / expired / draft |
| source_course | Yes | 来源课程名 |
| hours | Yes | 时长 |
| lessons | Yes | 课次数 |
| medical_boundary | Yes | 免责摘要 |

## 权限规则

| permission_level | 适用内容 | Agent 行为 |
|------------------|----------|------------|
| public | 基础理论、概念、养生观点 | 可完整返回 |
| restricted | 方证、案例、针法、峻药理论 | 仅理论摘要+来源 |
| confidential | 剂量、可识别病案 | 默认不返回 |

## 切分建议

- 按课次 + 标题切分
- 长度 700–900 汉字，重叠 80–100
- 方证表、禁忌、词汇表高权重
- 图片描述不向量化
