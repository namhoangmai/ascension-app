"""Runs project validation: typecheck, lint, format, and (eventually) tests.

Wraps the npm scripts already defined in package.json so both the
orchestrator and individual agents validate their work the same way a
human contributor would (see the `verify` script in package.json).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .executor import Executor
from .tools import ToolResult


@dataclass
class VerificationReport:
    checks: dict[str, ToolResult] = field(default_factory=dict)

    @property
    def passed(self) -> bool:
        return all(result.ok for result in self.checks.values())


class Verifier:
    """Runs this repo's validation commands and reports structured results."""

    def __init__(self, executor: Executor, cwd: str = ".") -> None:
        self.executor = executor
        self.cwd = cwd

    def run_typecheck(self) -> ToolResult:
        return self.executor.run_subprocess(["npm", "run", "typecheck"], cwd=self.cwd)

    def run_lint(self) -> ToolResult:
        return self.executor.run_subprocess(["npm", "run", "lint"], cwd=self.cwd)

    def run_format_check(self) -> ToolResult:
        return self.executor.run_subprocess(["npm", "run", "format:check"], cwd=self.cwd)

    def run_tests(self, scope: str = "") -> ToolResult:
        # TODO: package.json has no "test" script yet. Wire this up once a
        # test runner (vitest/jest/playwright) is added to the project.
        return ToolResult(ok=False, error="no test runner configured in package.json")

    def run_all(self) -> VerificationReport:
        report = VerificationReport()
        report.checks["typecheck"] = self.run_typecheck()
        report.checks["lint"] = self.run_lint()
        report.checks["format"] = self.run_format_check()
        report.checks["tests"] = self.run_tests()
        return report
