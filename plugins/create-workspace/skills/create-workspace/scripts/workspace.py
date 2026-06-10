#!/usr/bin/env python3
"""Manage a multi-repo Claude Code workspace's two machine-read files.

A workspace dir holds:
    .claude/settings.json   permissions.additionalDirectories = [real repo paths]  (the engine)
    <name>.code-workspace   multi-root: the workspace dir + each repo            (VS Code)
This script owns ONLY those two files (keeping them in sync) plus repo-name
resolution and `git init`. The agent writes CLAUDE.md and runs publish.

Subcommands:
  init   --name N --namespace NS --repo X [--repo Y ...] [--workspace-root R] [--search-root S]
  add    --dir D --repo X [--repo Y ...]
  remove --dir D --repo X [--repo Y ...]

Repos resolve as: an existing dir path is used as-is; a bare name is fuzzy-found
under --search-root (default ~/git), skipping existing workspaces.

Exit: 0 ok | 2 usage | 3 unresolved names (problems[] in JSON) |
4 repo not in workspace (remove) | 6 not a workspace | 7 no remote host
"""
from __future__ import annotations
import argparse, json, os, re, shutil, subprocess, sys
from pathlib import Path

PRUNE = {".git", "node_modules", ".venv", "vendor", "dist", "build", ".next", ".cache"}
# Repos under this root get portable workspace-relative refs; anything outside stays absolute.
MIRROR_ROOT = Path(os.environ.get("CW_MIRROR_ROOT", "~/git")).expanduser()


def find_repos(root: Path) -> list[Path]:
    """Dirs under root with a .git entry; skips our own workspaces and doesn't descend into a repo."""
    found: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        d = Path(dirpath)
        if (d / ".git").exists():
            if not any(f.endswith(".code-workspace") for f in filenames):   # not one of our workspaces
                found.append(d)
            dirnames[:] = []
            continue
        dirnames[:] = [n for n in dirnames if n not in PRUNE]
    return found


def resolve(arg: str, search_root: Path) -> tuple[Path | None, list[Path]]:
    """(resolved, candidates). resolved set => unique; candidates set => ambiguous."""
    p = Path(arg).expanduser()
    if p.exists() and p.is_dir():
        return p.resolve(), []
    if os.sep in arg or arg.startswith("~"):
        return None, []
    repos = find_repos(search_root)
    low = arg.lower()
    exact = [r for r in repos if r.name.lower() == low]
    if len(exact) == 1:
        return exact[0], []
    sub = [r for r in repos if low in r.name.lower()] or \
          [r for r in repos if low in str(r).lower()]
    if len(sub) == 1:
        return sub[0], []
    return None, sorted(set(exact + sub))


def resolve_batch(args: list[str], search_root: Path) -> tuple[list[str], list[dict]]:
    """Resolve every arg, collecting ALL problems at once (so the caller fixes them in one pass)."""
    paths: list[str] = []
    problems: list[dict] = []
    for arg in args:
        path, candidates = resolve(arg, search_root)
        if path is None:
            p = {"arg": arg, "error": "ambiguous" if candidates else "no_match"}
            if candidates:
                p["candidates"] = [str(c) for c in candidates]
            else:
                p["search_root"] = str(search_root)
            problems.append(p)
        else:
            paths.append(str(path))
    return paths, problems


def display_names(paths: list[str]) -> list[tuple[str, str]]:
    """(link, path), disambiguating basename collisions with the parent dir."""
    seen: set[str] = set()
    out: list[tuple[str, str]] = []
    for p in paths:
        pp = Path(p)
        link = pp.name if pp.name not in seen else f"{pp.parent.name}-{pp.name}"
        seen.add(link)
        out.append((link, str(pp)))
    return out


def to_ref(ws: Path, abspath: str) -> str:
    """Workspace-relative ref when both sit in the mirrored tree (portable across machines); else absolute."""
    p = Path(abspath)
    try:
        if p.is_relative_to(MIRROR_ROOT) and ws.is_relative_to(MIRROR_ROOT):
            return os.path.relpath(p, ws)
    except (ValueError, OSError):
        pass
    return str(p)


def load_json(path: Path) -> dict:
    """Existing JSON object, or {} if absent/empty/corrupt — so a merge never clobbers on a parse error."""
    try:
        data = json.loads(path.read_text())
        return data if isinstance(data, dict) else {}
    except (FileNotFoundError, ValueError):
        return {}


def write_machine_files(ws: Path, name: str, paths: list[str]) -> None:
    """Surgically update only the keys this script owns; preserve everything else the user/VS Code added.

    paths are absolute; written as workspace-relative refs where portable, absolute otherwise.
    settings.json: only permissions.additionalDirectories is rewritten.
    .code-workspace: only folders is rewritten (settings, extensions, launch, tasks, ... are kept).
    """
    (ws / ".claude").mkdir(parents=True, exist_ok=True)
    settings_path = ws / ".claude" / "settings.json"
    settings = load_json(settings_path)
    settings.setdefault("permissions", {})["additionalDirectories"] = [to_ref(ws, p) for p in paths]
    settings_path.write_text(json.dumps(settings, indent=2) + "\n")

    cw_path = ws / f"{name}.code-workspace"
    cw = load_json(cw_path)
    cw["folders"] = [{"name": f"✦ {name}", "path": "."}] + \
                    [{"name": link, "path": to_ref(ws, ap)} for link, ap in display_names(paths)]
    cw.setdefault("settings", {})
    cw_path.write_text(json.dumps(cw, indent=2) + "\n")


def current_paths(ws: Path) -> list[str]:
    """Read additionalDirectories and return ABSOLUTE paths (stored entries may be workspace-relative)."""
    settings = ws / ".claude" / "settings.json"
    if not settings.exists():
        print(json.dumps({"error": "not_a_workspace", "path": str(ws)}, indent=2))
        sys.exit(6)
    entries = json.loads(settings.read_text()).get("permissions", {}).get("additionalDirectories", [])
    return [str((p if (p := Path(e)).is_absolute() else ws / p).resolve()) for e in entries]


def git_out(repo: Path, *args: str) -> str | None:
    try:
        r = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, timeout=10)
        return r.stdout.strip() if r.returncode == 0 else None
    except Exception:
        return None


def parse_host(url: str | None) -> str | None:
    """Host out of git@host:path, ssh://git@host/path, or https://host/path."""
    if not url:
        return None
    m = re.match(r"(?:[a-z]+://)?(?:[^@/]+@)?([^:/]+)", url)
    return m.group(1) if m else None


def cmd_host(a) -> int:
    """Print the GitLab host to publish to, inferred from the workspace repos' remotes."""
    ws = Path(a.dir).expanduser().resolve()
    counts: dict[str, int] = {}
    for p in current_paths(ws):
        h = parse_host(git_out(Path(p), "remote", "get-url", "origin"))
        if h:
            counts[h] = counts.get(h, 0) + 1
    if not counts:
        print(json.dumps({"error": "no_remote_host", "dir": str(ws)}))
        return 7
    print(sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[0][0])   # most common, ties alphabetical
    return 0


def cmd_init(a) -> int:
    search_root = Path(a.search_root).expanduser()
    ws = Path(a.workspace_root).expanduser() / a.namespace / a.name
    if ws.exists() and any(ws.iterdir()):
        print(json.dumps({"error": "workspace_exists", "path": str(ws)}, indent=2))
        return 5
    paths, problems = resolve_batch(a.repo, search_root)
    if problems:
        print(json.dumps({"error": "unresolved", "problems": problems}, indent=2)); return 3
    ws.mkdir(parents=True, exist_ok=True)
    write_machine_files(ws, a.name, paths)
    (ws / ".gitignore").write_text(".DS_Store\n")
    subprocess.run(["git", "init", "-q", str(ws)], check=False)
    print(json.dumps({"workspace_dir": str(ws), "code_workspace": f"{a.name}.code-workspace",
                      "repos": [{"link": l, "path": p} for l, p in display_names(paths)]}, indent=2))
    return 0


def cmd_add(a) -> int:
    ws = Path(a.dir).expanduser().resolve()
    paths = current_paths(ws)
    new, problems = resolve_batch(a.repo, Path(a.search_root).expanduser())
    if problems:
        print(json.dumps({"error": "unresolved", "problems": problems}, indent=2)); return 3
    for p in new:
        if p not in paths:
            paths.append(p)
    write_machine_files(ws, ws.name, paths)
    print(json.dumps({"workspace_dir": str(ws), "repos": paths,
                      "note": "update the Repositories table in CLAUDE.md"}, indent=2))
    return 0


def cmd_remove(a) -> int:
    ws = Path(a.dir).expanduser().resolve()
    paths = current_paths(ws)
    for arg in a.repo:
        target = str(Path(arg).expanduser().resolve()) if Path(arg).expanduser().exists() else arg
        before = len(paths)
        paths = [p for p in paths if p != target and Path(p).name != arg]
        if len(paths) == before:
            print(json.dumps({"error": "no_match", "arg": arg,
                              "current": [Path(p).name for p in paths]}, indent=2))
            return 4
    write_machine_files(ws, ws.name, paths)
    print(json.dumps({"workspace_dir": str(ws), "repos": paths,
                      "note": "update the Repositories table in CLAUDE.md"}, indent=2))
    return 0


def cmd_open(a) -> int:
    """Open the workspace's .code-workspace in VS Code (or print the path if `code` is absent)."""
    ws = Path(a.dir).expanduser().resolve()
    cw = next(iter(sorted(ws.glob("*.code-workspace"))), None)
    target = str(cw) if cw else str(ws)
    if shutil.which("code"):
        subprocess.run(["code", target], check=False)
        print(json.dumps({"opened": target}))
    else:
        print(json.dumps({"open_manually": target, "note": "`code` not on PATH"}))
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    i = sub.add_parser("init")
    i.add_argument("--name", required=True)
    i.add_argument("--namespace", required=True, help="GitLab namespace = local sub-dir under workspace-root")
    i.add_argument("--repo", action="append", default=[], required=True)
    i.add_argument("--workspace-root", default="~/git/Paciolan/Gitlab")
    i.add_argument("--search-root", default="~/git")
    i.set_defaults(fn=cmd_init)

    for name in ("add", "remove"):
        s = sub.add_parser(name)
        s.add_argument("--dir", required=True)
        s.add_argument("--repo", action="append", default=[], required=True)
        s.add_argument("--search-root", default="~/git")
        s.set_defaults(fn=cmd_add if name == "add" else cmd_remove)

    h = sub.add_parser("host")
    h.add_argument("--dir", required=True)
    h.set_defaults(fn=cmd_host)

    o = sub.add_parser("open")
    o.add_argument("--dir", required=True)
    o.set_defaults(fn=cmd_open)

    a = ap.parse_args()
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
