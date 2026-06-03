---
name: leeroy-jenkins
description: Ship a GitLab MR end-to-end — approve, merge, update Fixed in Build, promote the Jira story, and play the lab deploy jobs.
when_to_use: 'Use when the user wants to merge an MR and run the lab deploys. Trigger phrases: "leeroy", "leeroy jenkins", "ship it", "merge and deploy", "deploy to lab", "send to qfnq", "finish this MR". Skip for prod/PUS releases — those are deliberate manual steps.'
argument-hint: '[env ...]   # subset of: dev qfnq qfns auto (default: all four)'
allowed-tools:
    - Bash(git *)
    - Bash(glab *)
    - ScheduleWakeup
    - Skill
    - mcp__plugin_claude-code-home-manager_gitlab__approve_merge_request
    - mcp__plugin_claude-code-home-manager_gitlab__get_merge_request
    - mcp__plugin_claude-code-home-manager_gitlab__merge_merge_request
    - mcp__plugin_claude-code-home-manager_gitlab__list_pipelines
    - mcp__plugin_claude-code-home-manager_gitlab__list_pipeline_jobs
    - mcp__plugin_claude-code-home-manager_gitlab__get_pipeline_job_output
    - mcp__plugin_claude-code-home-manager_gitlab__retry_pipeline_job
    - mcp__plugin_claude-code-home-manager_gitlab__play_pipeline_job
---

# leeroy-jenkins

Automate the boring tail of "I just opened an MR" — approvals, merge, fixed-in-build, story promotion, lab deploys.

## Battle cry (mandatory)

**First output, before any tool calls**, on its own line:

```
LEEEEERRRROOOOYYYY JEEEEEENKKKIIIINNNNSS!
```

## Target resolution

- **MR**: the one for the current branch. None → ask. Multiple → list and ask.
- **Project ID**: from the MR object.
- **Envs**: `$ARGUMENTS` if provided, else `[dev, qfnq, qfns, auto]`.
- **Jira key**: scan branch name → merged commit message → MR title → MR description for `[A-Z]+-\d+`. Missing is fine.

## Step 1 — Lower approvals if needed

The MCP `get_merge_request_approval_state` tool returns rule structure but **not** `user_can_approve` / `require_password_to_approve`. Use the REST endpoint:

```bash
glab api projects/<project_id>/merge_requests/<iid>/approvals
```

If `approvals_required > 1` and `user_can_approve: true`, POST to lower to 1 (the response confirms the new state, so skip the GET if confident):

```bash
glab api projects/<project_id>/merge_requests/<iid>/approvals -X POST -f approvals_required=1
```

- `user_can_approve: false` → "Prevent approval by author" is on. **Stop**, tell the user.
- `require_password_to_approve: true` → ask the user how to proceed (the MCP `approve_merge_request` tool accepts `approval_password`). Don't guess.

## Step 2 — Approve

`approve_merge_request(project_id, merge_request_iid)`.

## Step 3 — Merge (or queue auto-merge)

Check pipeline status via `get_merge_request`.

- **Green** → merge now.
- **Running** → `merge_when_pipeline_succeeds: true`. Step 5 needs the **master pipeline** which only exists post-merge, so `ScheduleWakeup` (~270s; CI is usually ~2 min) and check back. Do not poll.
- **Failed** → see *Failed pipelines* below. Do not merge over it.

```
merge_merge_request(
  project_id, merge_request_iid,
  merge_when_pipeline_succeeds: <bool>,
  should_remove_source_branch: true,
  squash: false,
)
```

## Step 4 — Fixed in Build + story promotion

After merge lands:

1. Find the master pipeline: `list_pipelines(ref=master, sha=<merge_commit_sha>)`.
2. Invoke the `fixed-in-build` skill with `<JIRA-KEY> <PIPELINE-URL>`, or just `<MR-URL>` if no Jira key. **Always call it** — the repo label gets applied either way.
3. If a Jira key was found and its status is **Code Review**, transition to **Dev Complete** after step 5 kicks off deploys. Any other status → leave it.

## Step 5 — Play deploy jobs

1. `list_pipeline_jobs` on the master pipeline.
2. Non-deploy prerequisites (`test`, `package-non-prod`) gate manual deploys via `dependencies:`. If still running, `ScheduleWakeup` ~120-180s and re-check.
3. For each requested env, find the job by name and `play_pipeline_job` on its ID. **Play in parallel** — they're independent.
4. Wake back up in ~1-2 min to confirm.

## Failed pipelines

Read the failing job log with `get_pipeline_job_output`. Categorize:

- **Transient / infra** (network errors, `getaddrinfo`, "runner unavailable", random 5xx, flaky single-shot test with no diff to the test file) → `retry_pipeline_job` once. Second failure → treat as real.
- **Real / code** (test failures referencing this branch, lint, compile) → read the room:
  - Collaborative session → summarize, point at file/line, propose a fix, get buy-in.
  - "Just ship it" mode + small mechanical fix (missing import, typo, snapshot) → propose + apply after confirm.
  - Non-trivial or unclear → **stop and hand back**.

When in doubt, ask. Wrong fix = reverted MR.

## Reporting

One line per step. Final summary with MR/commit/pipeline links:

```
✓ Approvals lowered 2 → 1
✓ Approved as joshuagibbs
✓ Auto-merge queued
✓ Fixed-in-build → INVT-3693
→ Deploys playing: dev, qfnq, qfns, auto (4 job links)
```

## Hard rules

- **Never** play `Deploy to Prod/PUS` or `Release`. Tag-gated, deliberate, user-only.
- **Never** lower approvals or approve on someone else's MR without an explicit ask.
- **Never** merge over a failing pipeline.
- **Never** poll in a tight loop — `ScheduleWakeup` for any wait > ~30s.
