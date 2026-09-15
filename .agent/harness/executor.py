"""Executes concrete actions (tool invocations) and returns structured results.

This is the one place that actually shells out to the OS or calls a Tool's
`run`, so every action an agent takes is auditable and timeout-bounded.
"""

from __future__ import annotations

import subprocess
import time
from dataclasses import dataclass, field
from typing import Any

from .permissions import PermissionSet
from .tools import TOOL_REGISTRY, ToolResult


@dataclass
class Action:
    """A single tool invocation requested by an agent."""

    tool: str
    args: dict[str, Any] = field(default_factory=dict)


@dataclass
class ExecutionResult:
    action: Action
    result: ToolResult
    duration_s: float


class Executor:
    """Runs Actions against the Tool registry, under one PermissionSet."""

    def __init__(self, permissions: PermissionSet) -> None:
        self.permissions = permissions

    def execute(self, action: Action) -> ExecutionResult:
        tool = TOOL_REGISTRY.get(action.tool)
        start = time.monotonic()
        if tool is None:
            result = ToolResult(ok=False, error=f"unknown tool: {action.tool}")
        else:
            try:
                result = tool.run(self.permissions, **action.args)
            except NotImplementedError as exc:
                result = ToolResult(ok=False, error=str(exc))
            except Exception as exc:  # a single bad action must not crash a run
                result = ToolResult(ok=False, error=f"{type(exc).__name__}: {exc}")
        return ExecutionResult(action=action, result=result, duration_s=time.monotonic() - start)

    def run_subprocess(self, command: list[str], cwd: str = ".", timeout_s: int = 300) -> ToolResult:
        """Shared subprocess runner, used by Verifier and (eventually) RunCommandTool."""
        try:
            proc = subprocess.run(
                command,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=timeout_s,
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            return ToolResult(ok=False, error=str(exc))
        return ToolResult(
            ok=proc.returncode == 0,
            output=proc.stdout,
            error=proc.stderr,
            data={"returncode": proc.returncode},
        )
