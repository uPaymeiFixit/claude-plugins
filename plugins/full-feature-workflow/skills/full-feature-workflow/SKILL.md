---
name: full-feature-workflow
description: 'End-to-end feature workflow: create a Jira item (if needed), implement the change, wait for review, commit & open MR, and notify blame authors.'
argument-hint: '[jira-key|confluence-url|path|description]'
disable-model-invocation: true
allowed-tools:
    - Skill
    - Read
    - Edit
    - Write
    - Glob
    - Grep
    - Bash
    - TodoWrite
    - AskUserQuestion
    - mcp__claude_ai_Atlassian__getJiraIssue
    - mcp__claude_ai_Atlassian__getConfluencePage
    - mcp__claude_ai_Atlassian__addCommentToJiraIssue
    - mcp__claude_ai_Atlassian__createJiraIssue
---

# Full feature workflow

Orchestrator that runs an entire feature from intake to Slack notifications by delegating to other skills.

**Resume semantics:** if any step stops to wait for the user or a sub-skill halts (e.g. push failure, missing MR URL), this skill also stops at that step. On re-invocation, resume from the first incomplete step using context already in the conversation. Use `TodoWrite` to track step state.

## Step 0: Check dependencies

This skill delegates to two **required** sibling skills from this marketplace:

- `commit-and-mr` (used in Step 5)
- `notify-blame` (used in Step 6)

They are installed separately. Before doing any work, check that they're installed by listing the user's installed skills (e.g. via the `/plugin` command or by looking for them in `${CLAUDE_PLUGIN_ROOT}` if available). If either is missing, stop and tell the user:

> This skill needs `commit-and-mr` and `notify-blame` from the `uPaymeiFixit-claude-plugins` marketplace. To install them:
>
> ```
> /plugin marketplace add git@github.com:uPaymeiFixit/claude-plugins.git
> /plugin install commit-and-mr@uPaymeiFixit-claude-plugins
> /plugin install notify-blame@uPaymeiFixit-claude-plugins
> /reload-plugins
> ```
>
> Then re-invoke `/full-feature-workflow`.

Do not continue past this step until both dependencies are available.

`create-jira-item` is also delegated to (in Step 2) but is optional — only required if the user opts to create a Jira story. Don't block on it here.

## Step 1: Identify the spec

Resolve `$ARGUMENTS` to a concrete spec. Set `JIRA_KEY`, `SPEC_TITLE`, `SPEC_BODY`, `SPEC_URL` for later steps:

| Input | Action | Sets |
| --- | --- | --- |
| Jira key (e.g. `PROJ-1234`) | `getJiraIssue` | `JIRA_KEY`, `SPEC_TITLE`, `SPEC_BODY` |
| Confluence URL | `getConfluencePage` | `SPEC_TITLE`, `SPEC_BODY`, `SPEC_URL` |
| File path | `Read` the file | `SPEC_BODY` (title from filename or first heading) |
| Plain description | use directly | `SPEC_BODY` |

If the input is ambiguous (could match multiple types), ask the user to clarify before proceeding.

## Step 2: Ensure a Jira story exists

If `JIRA_KEY` is already set from Step 1, skip this step.

Otherwise:

1. Use `AskUserQuestion` to confirm: "Create a Jira story for this work?" Options: `Yes`, `No, skip Jira`.
2. If **No**: set `JIRA_KEY=none` and continue.
3. If **Yes**: invoke `create-jira-item` with `$ARGUMENTS` set to `SPEC_TITLE`. After it returns, also:
    - Add `SPEC_BODY` to the issue description (edit the issue if `create-jira-item` did not include it).
    - If `SPEC_URL` is set (Confluence), add a remote issue link to that URL.
    - Record the new issue key as `JIRA_KEY`.

## Step 3: Execute the work

Implement the change. Run the relevant project checks. **Do not commit yet.**

If Step 4 sends you back here more than once, offer to create a checkpoint commit on the working branch before continuing — long iteration loops should not pile up uncommitted changes.

## Step 4: Wait for user review

Show the user the diff (`git diff` for unstaged, `git status` for the file list) and a one-paragraph summary of what changed and why. Then stop and wait for explicit approval.

Approval requires an unambiguous affirmative (e.g. "looks good", "ship it", "approved", "lgtm"). Treat anything else — questions, silence, partial responses, "ok" without context — as not-yet-approved and wait. If the user requests changes, return to Step 3.

## Step 5: Commit and open MR

Invoke `commit-and-mr` with `$ARGUMENTS` set to `jira=<JIRA_KEY>` (use `jira=none` if Step 2 was skipped). Record the resulting MR URL as `MR_URL`.

If `commit-and-mr` halts (push failure, branch question, etc.), this skill halts too — resume on next invocation.

## Step 6: Notify blame authors

Invoke `notify-blame` with `$ARGUMENTS` set to `MR_URL`.

## Step 7: Final report

Pass through `notify-blame`'s author table verbatim, then add:

- Jira: `JIRA_KEY` + URL (or "skipped")
- MR: `MR_URL`
