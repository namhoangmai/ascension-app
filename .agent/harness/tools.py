"""Tool interface available to agents.

Each Tool wraps one capability an agent can invoke (read a file, edit a
file, search the codebase, run a shell command, run tests). Tools are
permission-aware but not decision-making: they do exactly what they're
asked, after checking the request against a PermissionSet.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .permissions import AccessDenied, PermissionSet


@dataclass
class ToolResult:
    ok: bool
    output: str = ""
    error: str = ""
    data: dict[str, Any] = field(default_factory=dict)


class Tool(ABC):
    name: str
    description: str

    @abstractmethod
    def run(self, permissions: PermissionSet, **kwargs: Any) -> ToolResult:
        """Execute the tool. Implementations must check paths via
        `permissions.check(...)` before reading/writing anything."""


class ReadFileTool(Tool):
    name = "read_file"
    description = "Read the contents of a file in the repository."

    def run(self, permissions: PermissionSet, path: str = "", **_: Any) -> ToolResult:
        try:
            permissions.check(path)
        except AccessDenied as exc:
            return ToolResult(ok=False, error=str(exc))
        try:
            content = Path(path).read_text(encoding="utf-8")
        except OSError as exc:
            return ToolResult(ok=False, error=str(exc))
        return ToolResult(ok=True, output=content)


class EditFileTool(Tool):
    name = "edit_file"
    description = "Write (create/overwrite) a file in the repository."

    def run(self, permissions: PermissionSet, path: str = "", content: str = "", **_: Any) -> ToolResult:
        try:
            permissions.check(path)
        except AccessDenied as exc:
            return ToolResult(ok=False, error=str(exc))
        # TODO: support targeted diffs/patches instead of whole-file writes.
        try:
            Path(path).write_text(content, encoding="utf-8")
        except OSError as exc:
            return ToolResult(ok=False, error=str(exc))
        return ToolResult(ok=True, output=f"wrote {path}")


class SearchCodeTool(Tool):
    name = "search_code"
    description = "Search the codebase for a pattern (grep-like)."

    def run(self, permissions: PermissionSet, pattern: str = "", path: str = ".", **_: Any) -> ToolResult:
        # TODO: shell out to ripgrep/grep and filter matches to paths the
        # calling agent's PermissionSet allows.
        raise NotImplementedError("SearchCodeTool needs a search backend")


class RunCommandTool(Tool):
    name = "run_command"
    description = "Run a shell command (e.g. a build or codegen step)."

    def run(self, permissions: PermissionSet, command: str = "", cwd: str = ".", **_: Any) -> ToolResult:
        # TODO: delegate to executor.Executor.run_subprocess so commands go
        # through one audited, timeout-bounded execution path.
        raise NotImplementedError("RunCommandTool should delegate to executor.Executor")


class RunTestsTool(Tool):
    name = "run_tests"
    description = "Run the project's test suite (optionally scoped)."

    def run(self, permissions: PermissionSet, scope: str = "", **_: Any) -> ToolResult:
        # TODO: delegate to verifier.Verifier.run_tests().
        raise NotImplementedError("RunTestsTool should delegate to verifier.Verifier")


TOOL_REGISTRY: dict[str, Tool] = {
    tool.name: tool
    for tool in (ReadFileTool(), EditFileTool(), SearchCodeTool(), RunCommandTool(), RunTestsTool())
}
