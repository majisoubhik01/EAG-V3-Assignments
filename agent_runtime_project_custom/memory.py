from __future__ import annotations

import json
import re
import uuid
from datetime import datetime
from pathlib import Path

from schemas import MemoryItem, ToolCall

STATE_DIR = Path("state")
STATE_DIR.mkdir(exist_ok=True)

MEMORY_PATH = STATE_DIR / "memory.json"

if not MEMORY_PATH.exists():
    MEMORY_PATH.write_text("[]", encoding="utf-8")

STOPWORDS = {
    "the", "is", "a", "an", "and", "or", "to",
    "of", "in", "on", "for", "me", "my",
}


def tokenize(text: str) -> list[str]:
    words = re.findall(r"[a-zA-Z0-9]+", text.lower())
    return [w for w in words if w not in STOPWORDS]


def _load() -> list[MemoryItem]:
    raw = json.loads(MEMORY_PATH.read_text(encoding="utf-8"))
    return [MemoryItem.model_validate(x) for x in raw]


def _save(items: list[MemoryItem]) -> None:
    MEMORY_PATH.write_text(
        json.dumps(
            [x.model_dump(mode="json") for x in items],
            indent=2,
        ),
        encoding="utf-8",
    )


def remember(query: str, source: str, run_id: str) -> None:
    q = query.lower()

    if "birthday" not in q:
        return

    # Extract a canonical fact text (the full query is fine)
    fact_text = query
    kws = tokenize(query)

    print(f"[memory.remember]  classified {repr(fact_text)[:60]} as fact")
    print(f"                   keywords: {kws[:6]}")

    item = MemoryItem(
        id=f"mem:{uuid.uuid4().hex[:8]}",
        kind="fact",
        keywords=kws,
        descriptor=fact_text,
        value={"text": fact_text},
        artifact_id=None,
        source=source,
        run_id=run_id,
        goal_id=None,
        confidence=1.0,
        created_at=datetime.utcnow(),
    )

    items = _load()
    items.append(item)
    _save(items)


def read(query: str, history: list[dict], limit: int = 8) -> list[MemoryItem]:
    items = _load()
    q_tokens = set(tokenize(query))
    scored = []

    for item in items:
        overlap = len(q_tokens.intersection(set(item.keywords)))
        if overlap > 0:
            scored.append((overlap, item))

    scored.sort(key=lambda x: x[0], reverse=True)

    return [x[1] for x in scored[:limit]]


def record_outcome(
    tool_call: ToolCall,
    result_text: str,
    artifact_id: str | None,
    run_id: str,
    goal_id: str,
) -> None:
    item = MemoryItem(
        id=f"mem:{uuid.uuid4().hex[:8]}",
        kind="tool_outcome",
        keywords=tokenize(result_text),
        descriptor=result_text[:200],
        value={
            "tool": tool_call.name,
            "arguments": tool_call.arguments,
        },
        artifact_id=artifact_id,
        source=tool_call.name,
        run_id=run_id,
        goal_id=goal_id,
        confidence=1.0,
        created_at=datetime.utcnow(),
    )

    items = _load()
    items.append(item)
    _save(items)
