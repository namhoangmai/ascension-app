"""The Agent abstraction: one specialized worker that executes a Job.

An Agent is intentionally dumb glue: given a Context, ask an LLMProvider
what to do next, execute that action, repeat. All the "smarts" belong to
the LLMProvider (not yet implemented) and to the instructions in
.agent/agents/<NAME>.md — not to this class.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from .context import AgentContext
from .executor import Action, ExecutionResult, Executor
from .permissions import PermissionSet


@dataclass(frozen=True)
class AgentConfig:
    """Static definition of an agent, sourced from .agent/agents/<NAME>.md."""

    name: str
    permissions: PermissionSet
    allowed_tools: tuple[str, ...] = ()


class LLMProvider(Protocol):
    """Whatever backend decides an agent's next action given its context.

    TODO: implement a concrete provider (e.g. wrapping the Claude API) and
    pass it into Agent. Without one, Agent.step() cannot make decisions.
    """

    def decide(self, context: AgentContext) -> Action | None:
        """Return the next Action to take, or None if the job is complete."""


@dataclass
class AgentRunResult:
    job_id: str
    history: list[ExecutionResult] = field(default_factory=list)
    finished: bool = False
    summary: str = ""


class Agent:
    """Runs one Job to completion by looping: decide -> execute -> repeat."""

    def __init__(self, config: AgentConfig, executor: Executor, llm: LLMProvider | None = None) -> None:
        self.config = config
        self.executor = executor
        self.llm = llm

    def step(self, context: AgentContext) -> ExecutionResult | None:
        """Take one action given the current context, or None if done."""
        if self.llm is None:
            raise NotImplementedError("Agent.step requires an LLMProvider to decide actions")
        action = self.llm.decide(context)
        if action is None:
            return None
        return self.executor.execute(action)

    def run(self, context: AgentContext, max_steps: int = 25) -> AgentRunResult:
        """Loop step() until the agent signals completion or max_steps is hit."""
        result = AgentRunResult(job_id=context.job.id)
        for _ in range(max_steps):
            execution = self.step(context)
            if execution is None:
                result.finished = True
                break
            result.history.append(execution)
            context.history.append(execution)
        return result
