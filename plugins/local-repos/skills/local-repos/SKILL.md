---
name: local-repos
description: Points Claude at the local git-sync mirror of every Paciolan repo — local-first search, branching, and MRs that leave repos clean on their default branch.
when_to_use: 'Use whenever a Paciolan repo is referenced by name — "seat-ms", "the portal repo", any *-ms / *-ui / *-app name — or when searching code across repos, reading another team''s code, or branching / opening an MR. Every repo is already cloned under ~/git/Paciolan/ — never clone, and prefer local reads over GitLab MCP file fetches.'
---

# local-repos

[git-sync](https://github.com/uPaymeiFixit/git-sync) mirrors every org repo to `~/git/Paciolan/`:

| Path | What |
|---|---|
| `Gitlab/<path_with_namespace>` | canonical mirror, ~1600 repos from gitlabdev.paciolan.info |
| `Github/<name>` | github.com/Paciolan, flat, ~20 repos |
| `Bitbucket/phoenix` | frozen — sync disabled |
| `development/…` | the user's hand-managed tree: 9 repos, full history, real WIP (feature branches, uncommitted changes) |

`development/` duplicates the most-touched repos (seat-ms, …), so searches return double hits. Default to the `Gitlab/` copy; use `development/` for the user's WIP or full history. Never mutate either tree except the MR flow below — both can hold real uncommitted work; check `git status` first.

## Resolve a repo name

```bash
GITLAB_HOST=gitlabdev.paciolan.info glab api 'projects?search=seat-ms&simple=true' | jq -r '.[].path_with_namespace'
# local clone = ~/git/Paciolan/Gitlab/<path_with_namespace>   (1:1 mapping)
```
Offline (~3 s once, then ~7 ms per lookup):
```bash
find ~/git/Paciolan \( -name node_modules -o -name .git \) -prune -name .git -print | sed 's|/\.git$||' > /tmp/repos.txt
grep -i '/seat-ms$' /tmp/repos.txt
```
Domain names (`seat-ms`) are unique; generic basenames (`terraform` ×63, `app`, `api-gateway`, `gatling`, `k6`, `metrics`) need a group qualifier — ask rather than guess.

## Local vs remote

| Task | Use |
|---|---|
| find repo by name | remote project search (0.3 s) or `/tmp/repos.txt` |
| org-wide code search | remote blob search as locator (~1 s), then rg the local clone — tree-wide rg costs 30–45 s |
| search inside one repo | local rg (ms) |
| MRs, pipelines, issues, metadata | remote only (glab / GitLab MCP) |
| pushed within the last day | remote — sync runs only when the user clicks the GitSync menubar app |
| history / blame beyond ~100 commits | not the mirror (shallow clones) — `development/` tree or API |

```bash
GITLAB_HOST=gitlabdev.paciolan.info glab api 'search?scope=blobs&search=TERM&per_page=100'   # org-wide; group-scoped: groups/development/search?…
```
- Always prefix `glab api` with `GITLAB_HOST=gitlabdev.paciolan.info` — glab's config default is gitlab.com, which 401s. `glab auth status` exits nonzero (stray gitlab.com entry); don't gate on it.
- Blob search returns text fragments from default branches only — a locator, not a grepper. Dedupe by `project_id`, then rg the local clone.
- Mirror freshness: `stat -f %Sm ~/git/Paciolan/Gitlab/ballena/acs/.git/FETCH_HEAD` — the whole tree shares one sync timestamp.
- Only ~1600 of ~2300 server projects are synced (skip-list: pac-classic/evenue/web, pac-classic/svn, ballena/{seat-selection,seats3d}/implementations). No local hit ≠ absence — confirm remotely.
- All remote branches exist locally as `origin/*` refs: inspect a teammate's branch without fetching — `git log origin/<branch>`, `git grep TERM origin/<branch>`.

## Search pitfalls (verified on this machine)

- Bare `find` in the Bash tool is a bfs shim ~5× faster on this tree than `command find`; bare `grep` is a ugrep shim — just use `rg`.
- Default rg honors each repo's .gitignore — correct for source search. Never `--no-ignore` tree-wide (2–4× slower, garbage hits). If one repo unexpectedly returns nothing, retry `rg -uu` — whitelist .gitignores (`*` + `!…`) hide even tracked files.
- fd: globs are case-sensitive and silently return 0 hits — pass `-i`; pass `-E node_modules` (10 repos commit node_modules).
- Paths with spaces exist (under Gitlab/development/tools) — always `find -print0 | xargs -0`.
- `xargs rg` exit 123 = "some chunk had no match", not failure. GNU xargs runs the command even on empty input — add `-r`. `-I` silently overrides `-n`.
- No `timeout` binary here — use `gtimeout`.

Per-repo fan-out, <5 s across all ~1600 (needs `/tmp/repos.txt`):
```bash
xargs -P14 -I{} sh -c 'git -C "$1" show-ref -q --verify refs/heads/BRANCH && echo "$1"' _ {} < /tmp/repos.txt   # repos with branch
xargs -P14 -I{} sh -c 'git -C "$1" cat-file -e SHA 2>/dev/null && echo "$1"' _ {} < /tmp/repos.txt              # repos with commit
```

## Branch & MR — from the local clone

Work in the `Gitlab/` clone; never build MRs with GitLab MCP file-by-file commits.

1. Require a clean tree on the default branch before starting; if not, stop and ask — it may be the user's real work.
2. `default=$(git symbolic-ref --short refs/remotes/origin/HEAD | sed 's|^origin/||')` — set in 98% of repos; values include master, main, develop, dev, even ticket names. Never assume master. Fallback: `git show-ref -q --verify refs/remotes/origin/main`, then master.
3. Branch, commit, `git push -u origin <branch>`, then `glab mr create --fill --yes -b "$default"` (glab infers the project from cwd). Fallbacks: push options `-o merge_request.create -o merge_request.target=$default`; GitLab MCP `create_merge_request`.
4. Leave it clean: `git switch "$default"`, but only when `git status --porcelain` is empty AND the branch is pushed — `git switch` silently carries non-conflicting dirty files onto the default branch. Keep the local branch ref.
   If the user is still iterating on the branch, skip the switch and say so — git-sync just reports the repo "diverged" (harmless, but default-branch updates freeze until switched back).

Full commit/MR conventions (MR template, remove_source_branch, Jira): the commit-and-mr skill.
