#!/usr/bin/env python3
"""RAG chunking for TCM course notes with permission metadata."""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import List

CHUNK_SIZE = 700
CHUNK_OVERLAP = 80
HIGH_WEIGHT_SECTIONS = ["关键概念词汇表", "核心金句集", "禁忌", "方证表", "医疗边界"]


@dataclass
class Chunk:
    chunk_id: str
    file_id: str
    title: str
    sub_domain: str
    permission_level: str
    lesson: str
    section: str
    content: str
    tags: List[str]
    source: str
    medical_boundary: str


def simple_tokenize(text: str) -> List[str]:
    parts = re.split(r"(?=^#{1,3}\s+|^=+\s*$|^第\d+课|^【.+】)", text, flags=re.MULTILINE)
    return [p.strip() for p in parts if p.strip()]


def chunk_text(text: str, max_len: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    if len(text) <= max_len:
        return [text]
    chunks: List[str] = []
    start = 0
    while start < len(text):
        end = start + max_len
        if end < len(text):
            for sep in ["。", "！", "？", "\n\n", "\n"]:
                pos = text.rfind(sep, start, end)
                if pos > start + max_len // 2:
                    end = pos + 1
                    break
        chunks.append(text[start:end].strip())
        start = end - overlap
        if start >= len(text):
            break
    return [c for c in chunks if c]


def process_document(
    file_id: str,
    title: str,
    sub_domain: str,
    permission_level: str,
    raw_text: str,
    tags: List[str],
    source: str,
) -> List[Chunk]:
    sections = simple_tokenize(raw_text)
    chunks: List[Chunk] = []
    chunk_idx = 0
    for sec_idx, section in enumerate(sections):
        is_high = any(kw in section[:50] for kw in HIGH_WEIGHT_SECTIONS)
        sec_name = section[:30].replace("\n", " ") if section else f"section_{sec_idx}"
        for i, content in enumerate(chunk_text(section)):
            chunk_idx += 1
            chunks.append(
                Chunk(
                    chunk_id=f"{file_id}-{chunk_idx:04d}",
                    file_id=file_id,
                    title=title,
                    sub_domain=sub_domain,
                    permission_level=permission_level,
                    lesson=sec_name,
                    section=f"{sec_idx}-{i}",
                    content=content,
                    tags=tags + (["high_weight"] if is_high else []),
                    source=source,
                    medical_boundary="仅供学习与理论参考，禁止作为个人医疗建议或操作依据。",
                )
            )
    return chunks


def filter_by_permission(chunks: List[Chunk], user_level: str = "public") -> List[Chunk]:
    level_order = {"public": 0, "restricted": 1, "confidential": 2}
    user_rank = level_order.get(user_level, 0)
    return [c for c in chunks if level_order.get(c.permission_level, 1) <= user_rank]


def export_to_jsonl(chunks: List[Chunk], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        for c in chunks:
            f.write(json.dumps(asdict(c), ensure_ascii=False) + "\n")
    print(f"Exported {len(chunks)} chunks to {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Chunk TCM notes for RAG")
    parser.add_argument("--input", help="UTF-8 text file to chunk")
    parser.add_argument("--file-id", default="TCM-001")
    parser.add_argument("--title", default="示例文档")
    parser.add_argument("--sub-domain", default="八纲辨证")
    parser.add_argument("--permission", default="public")
    parser.add_argument("--source", default="课程蒸馏")
    parser.add_argument("--tags", default="八纲")
    parser.add_argument("--out", default="sample_chunks.jsonl")
    args = parser.parse_args()

    if args.input:
        raw = Path(args.input).read_text(encoding="utf-8")
    else:
        raw = """# 第1课：八纲辨证1

八纲辨证是中医治疗从感冒到癌症的普适框架。表里、寒热、虚实、阴阳是核心维度。

## 关键概念词汇表
八纲辨证：表、里、寒、热、虚、实、阴、阳八类核心维度。

## 核心金句
“中医可以从感冒治疗到癌症。”
"""

    chunks = process_document(
        file_id=args.file_id,
        title=args.title,
        sub_domain=args.sub_domain,
        permission_level=args.permission,
        raw_text=raw,
        tags=[t.strip() for t in args.tags.split(",") if t.strip()],
        source=args.source,
    )
    print(f"生成 {len(chunks)} 个 chunks")
    export_to_jsonl(chunks, Path(args.out))


if __name__ == "__main__":
    main()
