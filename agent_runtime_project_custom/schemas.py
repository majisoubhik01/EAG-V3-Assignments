from __future__ import annotations

from datetime import datetime
from typing import Literal, Any

from pydantic import BaseModel, model_validator


class MemoryItem(BaseModel):
    id: str
    kind: Literal["fact", "preference", "tool_outcome", "scratchpad"]
    keywords: list[str]
    descriptor: str
    value: dict[str, Any]
    artifact_id: str | None = None
    source: str
    run_id: str
    goal_id: str | None = None
    confidence: float
    created_at: datetime


class Artifact(BaseModel):
    id: str
    content_type: str
    size_bytes: int
    source: str
    descriptor: str


class Goal(BaseModel):
    id: str
    text: str
    done: bool = False
    attach_artifact_id: str | None = None


class Observation(BaseModel):
    goals: list[Goal]

    @property
    def all_done(self) -> bool:
        return all(g.done for g in self.goals)

    def next_unfinished(self) -> Goal:
        for goal in self.goals:
            if not goal.done:
                return goal
        raise ValueError("No unfinished goals")


class ToolCall(BaseModel):
    name: str
    arguments: dict[str, Any]


class DecisionOutput(BaseModel):
    answer: str | None = None
    tool_call: ToolCall | None = None

    @model_validator(mode="after")
    def validate_output(self):
        if self.answer and self.tool_call:
            raise ValueError("Only one of answer or tool_call may be populated")

        if not self.answer and not self.tool_call:
            raise ValueError("One of answer or tool_call must be populated")

        return self
