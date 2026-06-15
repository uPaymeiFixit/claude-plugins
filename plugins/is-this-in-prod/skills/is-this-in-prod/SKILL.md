---
name: is-this-in-prod
description: Answer "is this commit / MR / Jira story in production right now?" by checking what GitLab actually has deployed to the prod environment, rollbacks included.
when_to_use: 'Use when asked whether something is live in prod — "is INVT-3653 in production?", "did this MR ship?", "is commit abc123 deployed?", "is this in pus yet?". Works from a Jira key, an MR URL/IID, or a raw commit SHA.'
argument-hint: "A Jira key (INVT-3653), an MR URL/IID, and/or a commit SHA — any mix."
allowed-tools:
    - Bash(glab *)
    - Skill
    - mcp__plugin_claude-code-home-manager_gitlab__get_environment
    - mcp__plugin_claude-code-home-manager_gitlab__list_deployments
    - mcp__plugin_claude-code-home-manager_gitlab__list_environments
    - mcp__plugin_claude-code-home-manager_gitlab__get_merge_request
    - mcp__plugin_claude-code-home-manager_gitlab__get_commit
    - mcp__claude_ai_Atlassian__getJiraIssue
    - mcp__claude_ai_Atlassian__getJiraIssueRemoteIssueLinks
---

# is-this-in-prod

Answer one question: **is this code live in production right now?** Everything is read from GitLab — no local clone, no `git`.

> **Org-specific knob.** "Production" here is a GitLab environment named **`pus`**. To fork: change `PROD_ENV` below. Don't match on the environment `tier` field — the prod environment may be registered as tier `other`, so the **name** is the source of truth.

```
PROD_ENV=pus
```

The work is three moves: **(1)** resolve the input to a set of `(project, commit)` anchors, **(2)** find the commit each project actually has live in prod, **(3)** ask GitLab whether each anchor commit is an ancestor of that live commit. Tooling priority: GitLab MCP, else `glab api`. Use whichever is available — the steps are described by intent.

## 1 — Resolve the input to (project, commit) anchors

An anchor is a project + a commit SHA. How you get there depends on the input:

| Input | How to anchor it |
|---|---|
| Commit SHA | The user must say which repo, or it came from an MR/Jira. Resolve the repo to a project, use the SHA. |
| MR (URL or project+IID) | Project is in the URL/known. Commit = the MR's `merge_commit_sha` (or `squash_commit_sha`). **Unmerged ⇒ not in prod — stop here for this anchor.** |
| Jira key | Find its MRs (below), then each merged MR becomes an anchor. |

A Jira story can map to **several** MRs across **several** repos — resolve them all, each its own anchor. To find them, reuse the resolution chain from the `fixed-in-build` skill (call that Skill if available; otherwise do this):

1. **Remote issue links** (`GET /rest/api/3/issue/{key}/remotelink`) — collect every `…/-/merge_requests/<iid>` URL.
2. **Fixed in Build field** (`customfield_10041`) — it holds a pipeline URL, a comment permalink, or text. A pipeline URL pins a project + pipeline; resolve the pipeline's commit. A `focusedCommentId=` permalink ⇒ read that comment for more pipeline URLs.
3. **Comments and description** — scan bodies for the same MR/pipeline URL patterns.

Dedupe across all sources. If nothing resolves, say so and ask the user for the repo or MR — don't guess silently.

## 2 — Find the live prod commit for each project

For each project, the live prod commit is **the most recent *successful* deployment to `PROD_ENV`**. This is rollback-correct by construction: a rollback is just a newer successful deployment of an older commit, so the latest success is always what's actually serving.

```bash
glab api "projects/<id>/deployments?environment=$PROD_ENV&status=success&order_by=created_at&sort=desc&per_page=1"
```

Take `.[0].sha` — that's the live commit. Also grab `.[0].id`, `.ref`, and `.deployable.pipeline.id` for the report.

- **Don't** use the environment's `last_deployment` directly — that's the most recent deployment of *any* status, so a failed or in-flight redeploy sitting on top would mislead you. Query `status=success` and order by `created_at`.
- Order by **`created_at`**, not `finished_at` — deploy records may leave `finished_at` null, which makes that sort undefined. `created_at` desc among `status=success` is still rollback-correct (a rollback is a newer record redeploying an older sha) and is a valid `order_by` for the MCP `list_deployments` tool, so the MCP-first path works without dropping to `glab`.
- **No successful deployment found** ⇒ nothing from this repo is in prod; every anchor in it is "not in prod." Say so.
- **Fallback** (repo doesn't register the environment — empty `list_environments` match for `PROD_ENV`): scan recent default-branch pipelines for a successful prod-deploy job (e.g. one named `Deploy To PUS EKS`) and use that pipeline's `sha`. Note in the report that you fell back.

## 3 — Is the anchor commit in prod?

Compare the anchor commit against the live prod commit, **server-side** — no clone:

```bash
glab api "projects/<id>/repository/compare?from=<PROD_SHA>&to=<ANCHOR_SHA>"
```

- `commits` array **empty** ⇒ the anchor is reachable from prod ⇒ **IN PROD** ✅
- `commits` **non-empty** ⇒ the anchor has commits prod doesn't have yet ⇒ **NOT IN PROD** ❌ (the commit count is roughly how far behind it is)

Order matters: `from` is prod, `to` is the anchor. (`from=prod&to=X` empty means X is an ancestor of prod.) If the anchor SHA 404s the compare, the commit isn't on this project's default branch — flag it rather than calling it not-deployed.

## Report

One verdict per anchor, then an overall answer. A Jira story is **fully in prod** only when *every* resolved MR is in prod; if some are and some aren't, it's **partially deployed** — name which repos lag.

```
INVT-3653 — partially in prod
  ✅ order-ms      MR !412  merge a1b2c3d  →  live prod e1730ab  (in prod)
  ❌ cart-ms-next  MR !88   merge 9f8e7d6  →  live prod 4c5b6a7  (3 commits behind)
  ⏳ gql-ms        MR !21   open           →  not merged
```

Link MRs, pipelines, and the prod deployment when you have URLs. State the live prod SHA you compared against — it's the load-bearing fact, and lets the user sanity-check a rollback.
