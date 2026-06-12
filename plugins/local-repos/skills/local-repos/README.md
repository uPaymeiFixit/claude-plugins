# local-repos

Points Claude at the local git-sync mirror of every Paciolan repo — local-first search, branching, and MRs that leave repos clean on their default branch.

> [!NOTE]
> Everything here is Paciolan-specific by design: the mirror lives at `~/git/Paciolan/` (maintained by [git-sync](https://github.com/uPaymeiFixit/git-sync)) and the GitLab host is `gitlabdev.paciolan.info`. Forkers should re-run the same empirical tests against their own mirror — half the value is the verified timings and pitfalls.

### Old way

```mermaid
flowchart LR
    A["“what does seat-ms do?”"] --> B[search projects via GitLab API]
    B --> C[fetch files one API call at a time]
    C --> D[edit via API commits]
    D --> E[MR assembled remotely 🐌]
```

### New way

```mermaid
flowchart LR
    A["“what does seat-ms do?”"] --> B["~/git/Paciolan/Gitlab/…/seat-ms"]
    B --> C[rg / Read locally ⚡]
    C --> D[branch, commit, push, glab mr create]
    D --> E[git switch master ✅ left clean]
```

## Usage

Not usually invoked directly — Claude activates it whenever you mention a repo by name:

> look at seat-ms and tell me how marker assignments work

> search all our repos for uses of MarkerAssignments

> open an MR in order-ms that bumps the node version

## What it does

1. Resolves a bare repo name to its local clone — GitLab project search maps 1:1 to `~/git/Paciolan/Gitlab/<namespace>`, with a cached offline repo list as fallback.
2. Picks the faster side for each search: local `rg` inside a repo (milliseconds), but the GitLab blob search as an org-wide locator (~1 s vs ~40 s of local filesystem traversal).
3. Branches, commits, pushes, and opens MRs from the local clone with `glab`, then switches the repo back to its default branch so git-sync keeps fast-forwarding it.
4. Documents the verified pitfalls of searching the whole mirror: shallow (depth-100) clones, manual sync staleness, and fd/xargs/rg failure modes.

## Local or remote?

| Task | Winner |
|---|---|
| Find a repo by name | GitLab project search (0.3 s) |
| "Where in the org is X used?" | GitLab blob search to locate, local rg for context |
| Search inside one repo | local rg |
| MRs / pipelines / issues / metadata | API only |
| Anything pushed since the last menubar sync | API |

## Tooling

- [`glab`](https://gitlab.com/gitlab-org/cli) authenticated to gitlabdev.paciolan.info — repo lookup, org-wide code search, MR creation
- `rg` / `fd` for local search
- [git-sync](https://github.com/uPaymeiFixit/git-sync) keeps the mirror current (manual menubar trigger)
- GitLab MCP server (optional) — fallback for MR creation; metadata queries
- Related: [commit-and-mr](../../../commit-and-mr/skills/commit-and-mr/README.md) for the full commit → MR cycle, [create-workspace](../../../create-workspace/skills/create-workspace/README.md) for multi-repo contexts
