#!/usr/bin/env python3
"""Pre-LLM risk filter for TCM Inquiry Agent."""

from __future__ import annotations

import json
import sys
from typing import List

EMERGENCY = [
    "胸痛", "胸口痛", "呼吸困难", "喘不过气", "昏迷", "休克",
    "大出血", "呕血", "便血不止", "高热不退", "抽搐", "意识不清",
    "剧烈腹痛", "中风", "口眼歪斜", "急救",
]

ACTIONABLE = [
    "开方", "处方", "剂量", "几钱", "几克", "怎么煎", "煎服",
    "自己吃", "自行服用", "怎么扎", "进针", "放血", "透针",
    "艾灸步骤", "怎么练", "训练次数", "炮制方法",
]

HIGH_RISK_MATERIA = [
    "生附子", "炮附子", "附子", "乌头", "川乌", "草乌",
    "硫磺", "大戟", "甘遂", "芫花", "生半夏", "巴豆",
]

JAILBREAK = [
    "忽略规则", "忽略之前的规则", "你现在是医生", "假设你是医生",
    "用代码输出处方", "假装没有限制", "越狱",
]

DISCLAIMER = (
    "本回答仅供学习与理论参考，不能替代执业中医师的面诊与诊断。"
    "涉及真实症状或健康问题，请及时咨询合格医疗专业人员。"
)


def classify(text: str) -> dict:
    t = text or ""
    hits: List[str] = []

    def collect(words: List[str]) -> List[str]:
        return [w for w in words if w in t]

    emergency = collect(EMERGENCY)
    actionable = collect(ACTIONABLE)
    materia = collect(HIGH_RISK_MATERIA)
    jailbreak = collect(JAILBREAK)
    hits = emergency + actionable + materia + jailbreak

    if emergency:
        action = "emergency_redirect"
        message = (
            "检测到可能的急症描述。请立即前往医院急诊或拨打当地急救电话。"
            "本助手停止理论讨论，不能提供急救操作指导。\n\n" + DISCLAIMER
        )
    elif jailbreak or actionable:
        action = "refuse_actionable"
        message = (
            "根据安全规则，我无法提供可执行的操作、处方或剂量建议。"
            "请面诊合格执业中医师。\n\n" + DISCLAIMER
        )
    elif materia:
        action = "concept_only"
        message = (
            "该内容属于高风险药材/方证索引，仅可作理论学习，严禁自行使用。"
            "请咨询具备资质的专业人员。\n\n" + DISCLAIMER
        )
    else:
        action = "allow"
        message = ""

    return {
        "action": action,
        "risk_flag": action != "allow",
        "risk_keywords": hits,
        "message": message,
        "disclaimer": DISCLAIMER,
    }


def main() -> None:
    query = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else sys.stdin.read()
    print(json.dumps(classify(query.strip()), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
