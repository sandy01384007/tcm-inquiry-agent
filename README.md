# 经方问询助手 Skill（tcm-inquiry-agent）

中医小诊所 **理论检索 + 问诊辅助** Agent Skill。兼容 Grok / [agentskills.io](https://agentskills.io) 格式。

**定位**：帮助医师快速回顾八纲、六经、药性与课程观点，并结构化采集问诊信息。  
**不是**：自动开方、诊断或操作指导系统。

## 它能做什么

- 八纲 / 六经 / 脏腑 / 药性理论检索（带来源）
- 医师与助手权限分离
- 急症与峻药 Guardrails
- RAG 切分、元数据、审计日志
- Dify / FastGPT 诊所落地步骤
- 培训大纲与测试用例

## 它绝对不能做

- 确诊、开方、剂量、煎服法
- 针灸 / 艾灸 / 放血 / 透针操作步骤
- 功法训练处方
- 替代执业中医师决策

每条回答必须附带免责声明。

## 快速开始

将本仓库放入 Skills 目录：

```bash
mkdir -p ~/.grok/skills/tcm-inquiry-agent
cp -r ./* ~/.grok/skills/tcm-inquiry-agent/
```

### 触发词示例

- 中医 Agent / 经方问询 / 诊所问诊助手
- 八纲辨证、六经、伤寒论、金匮、内经
- 倪海厦课程知识库、Dify 中医助手
- TCM inquiry, syndrome differentiation

## 目录结构

```
tcm-inquiry-agent/
├── SKILL.md                          # Skill 主指令
├── README.md
├── LICENSE
├── assets/
│   └── glossary.json                 # 48 个核心概念
├── scripts/
│   ├── rag_chunking.py               # RAG 切分 + 权限过滤
│   ├── risk_filter.py                # 高风险 / 急症拦截
│   ├── generate_metadata_csv.py      # 知识库元数据
│   └── README.md
└── references/
    ├── system-prompt.md
    ├── role-prompts.md
    ├── safety-guardrails.md
    ├── clinic-workflow.md
    ├── install-guide.md
    ├── dify-fastgpt.md
    ├── ui-prototype.md
    ├── audit-log.md
    ├── training.md
    ├── test-cases.md
    └── metadata-schema.md
```

## 知识库说明

本 Skill **不包含** 受版权保护的完整课程讲稿或视频。诊所应使用自有、已获授权的蒸馏笔记作为 RAG 语料。Skill 提供概念词表、Prompt、切分脚本与安全规则。

## 脚本

```bash
python3 scripts/risk_filter.py "什么是八纲辨证"
python3 scripts/rag_chunking.py --help
python3 scripts/generate_metadata_csv.py
```

## 上线前必测

先跑 `references/test-cases.md` 的 **R 系列**（高风险拦截），再测理论问答。

## License

MIT
