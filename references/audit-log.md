# 审计日志字段设计

**目的**：满足诊所合规追溯、质控与纠纷举证需求。  
**原则**：记录完整、不可篡改、按权限可查询。

---

## 一、核心日志字段（每条对话必记）

| 字段名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| log_id | string | Yes | 全局唯一日志ID | log_20260926_001234 |
| timestamp | datetime | Yes | 精确到秒（ISO8601） | 2026-09-26T15:30:22+08:00 |
| clinic_id | string | Yes | 诊所标识 | CLINIC_001 |
| user_id | string | Yes | 操作人ID | DOC_023 |
| user_role | enum | Yes | 医师 / 助手 | 医师 |
| user_name | string | Yes | 操作人姓名（可脱敏） | 张医师 |
| session_id | string | Yes | 会话ID | sess_abc123 |
| patient_ref | string | No | 患者临时编号（脱敏） | P_20260926_008 |
| query_text | text | Yes | 用户原始输入 | 什么是八纲辨证？ |
| query_type | enum | Yes | 理论查询 / 问诊采集 / 高风险拦截 / 其他 | 理论查询 |
| risk_flag | boolean | Yes | 是否触发高风险拦截 | false |
| risk_keywords | array | No | 命中的风险词 | ["剂量", "附子"] |
| answer_summary | text | Yes | Agent回复摘要（前200字） | 八纲辨证是指... |
| sources | array | No | 引用的知识来源 | ["伤寒论-第3课", "八纲辨证-第1课"] |
| permission_level_used | enum | Yes | 实际使用的权限级别 | public / restricted |
| model_name | string | Yes | 使用的模型 | qwen2.5-72b |
| latency_ms | int | Yes | 响应耗时（毫秒） | 1850 |
| feedback | enum | No | 用户反馈（有用/无用） | 有用 |
| ip_address | string | No | 来源IP（内网可记） | 192.168.1.23 |
| device_info | string | No | 设备类型 | iPad / Windows |

---

## 二、扩展字段（按需）

| 字段名 | 说明 |
|--------|------|
| full_answer | 完整回复内容（可存对象存储，日志只存摘要） |
| context_tokens | 本次使用的上下文token数 |
| retrieval_chunks | 检索到的chunk_id列表 |
| error_code | 若失败，记录错误码 |
| human_takeover | 是否转人工（是/否） |

---

## 三、存储与保留策略

| 项目 | 建议 |
|------|------|
| 存储方式 | 数据库（PostgreSQL/MySQL）+ 对象存储（完整对话） |
| 保留期限 | 至少 3 年（根据当地医疗记录要求调整） |
| 备份 | 每日增量 + 每周全量 |
| 不可篡改 | 日志写入后禁止修改，仅可追加备注 |
| 访问控制 | 仅诊所管理员与授权医师可查询全量；助手仅看自己 |

---

## 四、常用查询场景

1. **纠纷追溯**：按 patient_ref + 时间范围查出完整对话
2. **质控抽查**：按 risk_flag=true 筛高风险拦截记录
3. **使用统计**：按 user_id 统计提问次数与高频问题
4. **模型效果**：按 feedback 分析有用率
5. **权限审计**：检查助手账号是否越权访问 restricted 内容

---

## 五、实现建议（Dify / FastGPT）

- Dify：开启「日志」功能，并通过 Webhook 推送到自建数据库
- FastGPT：使用「对话记录」导出 + 定时同步
- 自建：在 API 网关层统一记录以上字段

---

## 六、隐私与合规注意

- 患者姓名、手机号、身份证等 **不得** 明文写入日志
- 使用临时编号（P_YYYYMMDD_XXX）替代
- 日志访问本身也需审计（谁在什么时间查看了哪条日志）
- 定期进行日志完整性校验

---

## 七、最小可用字段集（快速上线）

如果资源有限，优先保证以下字段：

```
log_id, timestamp, clinic_id, user_id, user_role, 
session_id, query_text, risk_flag, answer_summary, 
sources, permission_level_used
```
