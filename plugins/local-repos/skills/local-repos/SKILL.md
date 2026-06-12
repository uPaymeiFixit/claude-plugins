---
name: local-repos
description: Points Claude at the local git-sync mirror of every Paciolan repo — local-first search, branching, and MRs that leave repos clean on their default branch.
when_to_use: 'Use whenever a Paciolan repo is referenced by name — "seat-ms", "the portal repo", any *-ms / *-ui / *-app name — or when searching code across repos, reading another team''s code, or branching / opening an MR. Every repo is already cloned under ~/git/Paciolan/ — never clone, and prefer local reads over GitLab MCP file fetches.'
---

# local-repos

[git-sync](https://github.com/uPaymeiFixit/git-sync) mirrors every org repo to `~/git/Paciolan/`:

| Path | Source |
|---|---|
| `Gitlab/<path_with_namespace>` | gitlabdev.paciolan.info, nested by group |
| `Github/<name>` | github.com/Paciolan, flat |
| `Bitbucket/<slug>` | bitbucket.org/paciolan |

Mirror repos can hold the user's real local work (feature branches, uncommitted changes) — check `git status` before touching one, and never mutate the tree except the MR flow below.

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
Domain names (`seat-ms`) are usually unique; generic basenames (`terraform`, `app`, `api-gateway`, `gatling`, `k6`, `metrics`) recur in dozens of groups — get a group qualifier or ask rather than guess.

## Local vs remote

| Task | Use |
|---|---|
| find repo by name | remote project search (0.3 s) or `/tmp/repos.txt` |
| org-wide code search | remote blob search as locator (~1 s), then rg the local clone — tree-wide rg costs 30–45 s |
| search inside one repo | local rg (ms) |
| MRs, pipelines, issues, metadata | remote only (glab / GitLab MCP) |
| pushed since the last sync | remote — sync runs only when the user clicks the GitSync menubar app |
| history / blame beyond ~100 commits | not the mirror (shallow clones) — API, or a full clone in /tmp |

```bash
glab api 'search?scope=blobs&search=TERM&per_page=100'   # org-wide; group-scoped: groups/development/search?…
```
- glab's default host is configured as gitlabdev.paciolan.info; if `glab api` ever 401s, check `glab config get -g host`.
- Blob search returns text fragments from default branches only — a locator, not a grepper. Dedupe by `project_id`, then rg the local clone.
- Mirror freshness: `stat -f %Sm <repo>/.git/FETCH_HEAD` on any one repo — the whole tree shares one sync timestamp.
- Sync settings can exclude some server projects. No local hit ≠ absence — confirm remotely.
- All remote branches exist locally as `origin/*` refs: inspect a teammate's branch without fetching — `git log origin/<branch>`, `git grep TERM origin/<branch>`.

## Search pitfalls (verified on this machine)

- Bare `find` in the Bash tool is a bfs shim ~5× faster on this tree than `command find`; bare `grep` is a ugrep shim — just use `rg`.
- Default rg honors each repo's .gitignore — correct for source search. Never `--no-ignore` tree-wide (2–4× slower, garbage hits). If one repo unexpectedly returns nothing, retry `rg -uu` — whitelist .gitignores (`*` + `!…`) hide even tracked files.
- fd wins filename searches (pass `-E node_modules` — some repos commit it), but its globs are case-sensitive (0 hits silently — pass `-i`), and for repo enumeration it needs `-HI` to not miss repos and is still ~2× slower than the pruned find above.
- Paths with spaces exist in the tree — always `find -print0 | xargs -0`.
- `xargs rg` exit 123 = "some chunk had no match", not failure. GNU xargs runs the command even on empty input — add `-r`. `-I` silently overrides `-n`.
- No `timeout` binary here — use `gtimeout`.

Per-repo fan-out, <5 s across the whole tree (needs `/tmp/repos.txt`):
```bash
xargs -P14 -I{} sh -c 'git -C "$1" show-ref -q --verify refs/heads/BRANCH && echo "$1"' _ {} < /tmp/repos.txt   # repos with branch
xargs -P14 -I{} sh -c 'git -C "$1" cat-file -e SHA 2>/dev/null && echo "$1"' _ {} < /tmp/repos.txt              # repos with commit
```

## Branch & MR — from the local clone

Work in the `Gitlab/` clone; never build MRs with GitLab MCP file-by-file commits.

1. Require a clean tree on the default branch before starting; if not, stop and ask — it may be the user's real work.
2. `default=$(git symbolic-ref --short refs/remotes/origin/HEAD | sed 's|^origin/||')` — set in nearly every repo; values include master, main, develop, dev, even ticket names. Never assume master. Fallback: `git show-ref -q --verify refs/remotes/origin/main`, then master.
3. Branch, commit, `git push -u origin <branch>`, then `glab mr create --fill --yes -b "$default"` (glab infers the project from cwd). Fallbacks: push options `-o merge_request.create -o merge_request.target=$default`; GitLab MCP `create_merge_request`.
4. Leave it clean: `git switch "$default"`, but only when `git status --porcelain` is empty AND the branch is pushed — `git switch` silently carries non-conflicting dirty files onto the default branch. Keep the local branch ref.
   If the user is still iterating on the branch, skip the switch and say so — git-sync just reports the repo "diverged" (harmless, but default-branch updates freeze until switched back).

Full commit/MR conventions (MR template, remove_source_branch, Jira): the commit-and-mr skill.
