"""Shared plumbing for shelling out to local conversion tools (ffmpeg,
LibreOffice, Poppler, mutool). Every converter module in this package
uses `run()` so subprocess handling, timeouts, and error messages are
consistent.
"""

import os
import shutil
import subprocess


class ToolNotFound(Exception):
    """Raised when a required local tool isn't on PATH or configured via env var."""


class ConversionError(Exception):
    """Raised when a tool runs but fails (bad input, unsupported pair, crash)."""


def find_tool(env_var: str, *candidates: str) -> str:
    """Resolve a tool's executable path: explicit env var override first,
    then the first name in `candidates` found on PATH.
    """
    override = os.getenv(env_var)
    if override:
        if not os.path.isfile(override):
            raise ToolNotFound(f"{env_var} is set to {override!r}, but that file doesn't exist.")
        return override

    for name in candidates:
        found = shutil.which(name)
        if found:
            return found

    raise ToolNotFound(
        f"Couldn't find {candidates[0]} on PATH. Install it, or set {env_var} to its full path in server/.env."
    )


def tool_available(env_var: str, *candidates: str) -> bool:
    """Non-raising version of find_tool(), for /health reporting."""
    try:
        find_tool(env_var, *candidates)
        return True
    except ToolNotFound:
        return False


def run(args: list[str], *, timeout: int = 120) -> subprocess.CompletedProcess:
    """Run a conversion tool, raising ConversionError with its stderr on
    non-zero exit or timeout — the message a user actually needs to see.
    """
    try:
        result = subprocess.run(
            args,
            capture_output=True,
            timeout=timeout,
            # Tool output isn't reliably UTF-8 (LibreOffice in particular);
            # decode leniently rather than crash on a stray byte.
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    except FileNotFoundError as exc:
        raise ToolNotFound(f"Could not execute {args[0]}: {exc}") from exc
    except subprocess.TimeoutExpired as exc:
        raise ConversionError(f"{os.path.basename(args[0])} timed out after {timeout}s.") from exc

    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "no output").strip()
        raise ConversionError(f"{os.path.basename(args[0])} failed: {detail[-800:]}")

    return result
