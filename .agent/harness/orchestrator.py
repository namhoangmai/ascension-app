"""Coordinates multiple specialized agents against a shared job queue.

This is the ONE shared harness. There is no per-agent Orchestrator/Executor
subclass — behavior differences between BACKEND/FRONTEND/TESTING/etc. live
entirely in AGENT_PERMISSIONS and in each agent's .agent/agents/<NAME>.md
instructions, not in code here.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from .agent import Agent, AgentConfig, AgentRunResult, LLMProvider
from .context import ContextBuilder, Job, RepoState
from .executor import Executor
from .permissions import PermissionSet
from .verifier import VerificationReport, Verifier

HARNESS_DIR = Path(__file__).resolve().parent
AGENTS_DIR = HARNESS_DIR.parent / "agents"

# Static per-agent permission grants (patterns are repo-relative, POSIX-style).
# TODO: parse these from the "Allowed"/"Forbidden" sections of each
# .agent/agents/<NAME>.md file instead of duplicating them here.
AGENT_PERMISSIONS: dict[str, PermissionSet] = {
    "BACKEND": PermissionSet(
        allowed=("src/features/*", "src/features/**", "src/lib/*", "src/lib/**", "src/app/api/**", "prisma/*"),
        forbidden=("src/components/**", "src/app/(app)/**", "src/app/(auth)/**"),
    ),
    "FRONTEND": PermissionSet(
        allowed=("src/app/**", "src/components/**", "src/styles/**", "src/hooks/**"),
        forbidden=("prisma/**", "src/lib/auth/**", "src/lib/db/**"),
    ),
    "TESTING": PermissionSet(
        allowed=("**/*.test.*", "**/*.spec.*", "src/**", ".agent/harness/*"),
        forbidden=("prisma/migrations/**",),
    ),
    "REVIEWER": PermissionSet(
        allowed=("**",),
        forbidden=(".env", ".env.*"),
    ),
    "ORCHESTRATOR": PermissionSet(
        allowed=("**",),
        forbidden=(".env", ".env.*"),
    ),
}


@dataclass
class WorkflowState:
    """Shared, mutable state visible across the whole multi-agent run."""

    jobs: dict[str, Job] = field(default_factory=dict)
    results: dict[str, AgentRunResult] = field(default_factory=dict)
    repo_state: RepoState = field(default_factory=RepoState)


class Orchestrator:
    def __init__(self, agents_dir: Path = AGENTS_DIR) -> None:
        self.context_builder = ContextBuilder(agents_dir)
        self.state = WorkflowState()
        self.llm: LLMProvider | None = None  # TODO: inject a real LLMProvider

    def register_job(self, job: Job) -> None:
        self.state.jobs[job.id] = job

    def make_agent(self, name: str) -> Agent:
        permissions = AGENT_PERMISSIONS.get(name, PermissionSet())
        config = AgentConfig(name=name, permissions=permissions)
        executor = Executor(permissions)
        return Agent(config=config, executor=executor, llm=self.llm)

    def run_job(self, job_id: str) -> AgentRunResult:
        job = self.state.jobs[job_id]
        agent = self.make_agent(job.agent)
        context = self.context_builder.build(job, self.state.repo_state)
        result = agent.run(context)
        self.state.results[job_id] = result
        return result

    def run_all(self) -> dict[str, AgentRunResult]:
        for job_id in list(self.state.jobs):
            self.run_job(job_id)
        return self.state.results

    def verify(self) -> VerificationReport:
        """Run project-wide validation, independent of any single agent."""
        executor = Executor(PermissionSet(allowed=("**",)))
        return Verifier(executor).run_all()
