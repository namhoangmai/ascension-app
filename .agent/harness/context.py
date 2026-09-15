"""Builds and manages the context handed to an Agent for one Job.

A Job is a specific task ("fix the nutrition log form validation"). An
AgentContext bundles that Job with the agent's static instructions, a
snapshot of relevant repo state, and the history of tool results so far —
everything the agent needs to decide its next action.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .executor import ExecutionResult


@dataclass
class Job:
    """A specific task assigned to one agent."""

    id: str
    description: str
    agent: str  # agent name, must match a file in .agent/agents/<agent>.md
    inputs: dict[str, Any] = field(default_factory=dict)


@dataclass
class RepoState:
    """A lightweight, read-only snapshot of repository state relevant to a job."""

    branch: str = ""
    changed_files: tuple[str, ...] = ()
    notes: dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentContext:
    """Everything an Agent needs to act on one Job."""

    instructions: str
    job: Job
    repo_state: RepoState
    history: list[ExecutionResult] = field(default_factory=list)

    def as_prompt(self) -> str:
        """Flatten this context into text suitable for an LLM call.

        TODO: apply a real token budget (truncate/summarize history and
        repo_state) instead of a fixed last-10-actions window.
        """
        lines = [self.instructions, "", f"Job: {self.job.description}"]
        if self.repo_state.changed_files:
            lines.append("Changed files: " + ", ".join(self.repo_state.changed_files))
        for item in self.history[-10:]:
            lines.append(f"- {item.action.tool}({item.action.args}) -> ok={item.result.ok}")
        return "\n".join(lines)


class ContextBuilder:
    """Assembles AgentContext from an agent's instruction file and repo state."""

    def __init__(self, agents_dir: Path) -> None:
        self.agents_dir = agents_dir

    def load_instructions(self, agent_name: str) -> str:
        path = self.agents_dir / f"{agent_name}.md"
        return path.read_text(encoding="utf-8") if path.exists() else ""

    def build(
        self,
        job: Job,
        repo_state: RepoState,
        history: list[ExecutionResult] | None = None,
    ) -> AgentContext:
        return AgentContext(
            instructions=self.load_instructions(job.agent),
            job=job,
            repo_state=repo_state,
            history=list(history or []),
        )

    # TODO: populate RepoState automatically (git status/diff, relevant file
    # excerpts for job.inputs) instead of requiring callers to build it.
