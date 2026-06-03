---
name: create-workspace
description: Stitch several existing repos into one Claude Code context for cross-repo feature work, then publish the workspace to GitLab.
when_to_use: 'Use when starting work that spans multiple repositories, or to assemble repos — by directory path, bare name (searched under ~/git), or a Jira ticket — into one workspace. Trigger phrases: "create a workspace", "multi-repo workspace", "work across repos".'
argument-hint: '[name] [repo ... | jira=<KEY>]'
---

# Create a multi-repo workspace

Builds a small **versioned git repo** that wires several existing repos into one Claude Code context. The repos stay where they are — the workspace only *references* them via `permissions.additionalDirectories` plus a multi-root `.code-workspace`.

Created at `~/git/Paciolan/Gitlab/<username>/<name>` (so the existing git-sync picks it up) and published over SSH to the GitLab host inferred from the added repos' git remotes.

```
<name>/
├── CLAUDE.md               # you write this — what each repo is + how to maintain it
├── .claude/settings.json   # permissions.additionalDirectories = [real repo paths]  ← the engine
└── <name>.code-workspace   # multi-root: the workspace dir + each repo
```

Scripts live under `${CLAUDE_SKILL_DIR}/scripts/` (resolved at run time — never hardcode the path).

## Inputs (ask for whatever is missing)
- **name** — kebab-case.
- **repos** — any mix of: existing directory paths (used as-is, even outside `~/git`), bare repo names (fuzzy-found under `~/git`), or a **Jira key**.
- **feature** (optional) — one-line description.

## Steps

1. **If given a Jira key**, fetch it with the Atlassian Jira MCP tool (search tools for `getJiraIssue`). Read the summary/description/links, propose the repo names you find, and keep the issue's web URL for step 4. **Confirm the repo list** with the user.

2. **Resolve the username** for the namespace: invoke the `person-to-user-map` skill if available; otherwise use the local-part of `git config user.email`.

3. **Confirm, then scaffold.** First show the user the workspace `<name>`, `<namespace>`, and the full resolved repo list, and ask to proceed — this catches name typos before anything is created. Then:
   ```
   python3 ${CLAUDE_SKILL_DIR}/scripts/workspace.py init --name <name> --namespace <username> \
     --repo <name-or-path> --repo <name-or-path> ...
   ```
   - Exit **3** = some repos unresolved → JSON `problems[]` lists each (`ambiguous` with `candidates`, or `no_match`). Resolve them all with the user in one pass, then re-run with explicit paths.
   - Success prints `{workspace_dir, repos: [{link, path}]}`.

4. **Write `CLAUDE.md`** in `workspace_dir`. Read each repo's own CLAUDE.md/README to summarize it. Keep it brief:
   - One-line workspace/feature description; if from Jira, a markdown link to the issue's web URL.
   - A table: repo → one-line purpose.
   - "Each repo has its own CLAUDE.md — read it before working in that repo."
   - A **maintenance** note — do **not** bake a script path in (it would go stale on plugin upgrade): "To add or remove a repo, ask Claude to update this workspace."

5. **Publish to GitLab** (personal namespace, SSH):
   ```
   bash ${CLAUDE_SKILL_DIR}/scripts/publish_workspace.sh --dir <workspace_dir> --namespace <username> --name <name>
   ```
   If it reports `glab` isn't authenticated, or that your account can't create projects (External), relay its fix message and stop.

6. **Open it in VS Code**, then report:
   ```
   python3 ${CLAUDE_SKILL_DIR}/scripts/workspace.py open --dir <workspace_dir>
   ```
   Then print the workspace path and note it reopens with that same command, or `cd <workspace_dir> && claude` for the CLI. (`open` prints the path instead if `code` isn't on PATH.)

## Add or remove a repo later
Keeps both reference files in sync (`init`-style exit 3 with `problems[]` on unresolved names); afterward update the Repositories table in that workspace's `CLAUDE.md`:
```
python3 ${CLAUDE_SKILL_DIR}/scripts/workspace.py add    --dir <workspace_dir> --repo <name-or-path>
python3 ${CLAUDE_SKILL_DIR}/scripts/workspace.py remove --dir <workspace_dir> --repo <name-or-basename>
```

## Notes
- Workspace location: `~/git/Paciolan/Gitlab/<username>` (override with `--workspace-root`). Repo-name search: `~/git` (override with `--search-root`).
- Existing workspaces (dirs with a `.code-workspace`) are skipped during repo-name resolution.
