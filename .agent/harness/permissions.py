"""Path-based access control for agents.

Every agent (see .agent/agents/*.md) is granted a PermissionSet describing
which repo-relative paths it may read or write. Tools and the Executor must
check paths against this before touching the filesystem.
"""

from __future__ import annotations

from dataclasses import dataclass
from fnmatch import fnmatch
from pathlib import Path


class AccessDenied(Exception):
    """Raised when an agent attempts to access a path outside its grant."""


@dataclass(frozen=True)
class PermissionSet:
    """Glob patterns (repo-relative, POSIX-style) describing an access grant.

    `forbidden` always wins over `allowed`, even if a forbidden pattern is
    more general than an allowed one — deny takes precedence.
    """

    allowed: tuple[str, ...] = ()
    forbidden: tuple[str, ...] = ()

    def is_allowed(self, path: str | Path) -> bool:
        rel = _normalize(path)
        if any(fnmatch(rel, pattern) for pattern in self.forbidden):
            return False
        return any(fnmatch(rel, pattern) for pattern in self.allowed)

    def check(self, path: str | Path) -> None:
        if not self.is_allowed(path):
            raise AccessDenied(f"access denied for path: {path}")


def _normalize(path: str | Path) -> str:
    return Path(path).as_posix().lstrip("./")


# TODO: derive PermissionSet objects from the "Allowed"/"Forbidden" sections
# of each .agent/agents/<NAME>.md file instead of hardcoding them in
# orchestrator.py, so the markdown stays the single source of truth.
