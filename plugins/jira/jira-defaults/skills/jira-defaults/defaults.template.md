# Jira defaults

Stored at `$XDG_DATA_HOME/jira-defaults.md` (fallback `~/.local/share/jira-defaults.md`).

## Defaults

Baseline config. Keep every row; replace `<placeholders>` with real values.

cloudId: `paciolan.atlassian.net`

| Field               | Value                                             | Notes                                                                                                                                                                |
| ------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| projectKey          | `<KEY>`                                           |                                                                                                                                                                      |
| issue type          | `Story`                                           |                                                                                                                                                                      |
| parent              | `<KEY-123>`                                       |                                                                                                                                                                      |
| assignee            | `<Display Name>` (accountId `<accountId>`)        |                                                                                                                                                                      |
| Dev Team (required) | `customfield_<id>`: {"id": "<value>"} (`<label>`) |                                                                                                                                                                      |
| target-status       | `<status name, e.g. To Do>`                       |                                                                                                                                                                      |
| labels              | `<project-name>` (computed)                       | project-name = the `name` field from the repo's `package.json`; if absent, fall back to the basename of `git rev-parse --show-toplevel`. Add to any requested labels. |
| fixVersions         | `[{"id": "10844"}]` (`RELEASE NOT NEEDED`)        | Required to reach Resolved. Override per-issue if the work targets a real release.                                                                                   |

### Custom Fields

| Custom Field   | ID                  | Notes                                             |
| -------------- | ------------------- | ------------------------------------------------- |
| Fixed in Build | `customfield_10041` | Free-text. Set to the pipeline URL after merging. |
| Dev Team       | `customfield_<id>`  | Required single-select. Default value above.      |

## Workflow Transitions

Transition IDs below are **shared across projects** at Paciolan but **differ by issue type** — Story / Bug / Spike share one workflow; Epic, Task, Sub-task each have their own; Initiative is a special case. The tables are organized by issue-type group.

> **Heads up**: same transition NAME can have different IDs across workflows. E.g. `Confirm Cancellation` is `1191` on Story but `71` on Epic, and `Back To Dev` is `1231` from Code Review but `1241` from UX Review. Always pick the ID for the issue type _and_ the source status.

### Transitioning through multiple states

When asked to move an issue to a specific status (e.g. "move to In Dev"), transition through each intermediate state in order, using the per-issue-type tables below. For example, on a Story: Open → In Dev requires Open → Refined (`1221`) → To Do (`1211`) → In Dev (`1081`).

### Story / Bug / Spike (shared workflow)

#### Forward transitions

| From           | To             | ID     | Name                               | Notes                                                                                                            |
| -------------- | -------------- | ------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Open           | Refined        | `1221` | Refined                            | Global transition — works from any state.                                                                        |
| Refined        | To Do          | `1211` | Prioritized                        |                                                                                                                  |
| To Do          | In Dev         | `1081` | Start Dev                          |                                                                                                                  |
| In Dev         | Code Review    | `1141` | Start Code Review                  |                                                                                                                  |
| Code Review    | UX Review      | `1101` | Start UX Review                    | Conditional — only appears when the issue's `UX Required` field is checked. Skip if not surfaced.                |
| Code Review    | Dev Complete   | `1171` | Complete Development w/o UX Review | Use when no UX review needed.                                                                                    |
| Code Review    | Dev Complete   | `871`  | Complete BO Development            | Alternate path observed on EVS Stories (likely BackOffice-specific). Prefer `1171` unless `1171` is unavailable. |
| UX Review      | Dev Complete   | `1181` | Complete Development               |                                                                                                                  |
| Dev Complete   | In QA          | `1071` | Start QA                           |                                                                                                                  |
| In QA          | Resolved       | `1151` | Move to Resolve                    | `hasScreen: true` — requires `resolution` + `fixVersions`. Pass `{"resolution": {"name": "Done"}, "fixVersions": <defaults.fixVersions>}`. |
| Resolved       | Ready for Prod | `2`    | Get Ready for Prod                 |                                                                                                                  |
| Ready for Prod | Closed         | `1111` | Move to Prod                       |                                                                                                                  |

#### Back transitions

| From        | To     | ID     | Name        |
| ----------- | ------ | ------ | ----------- |
| Code Review | In Dev | `1231` | Back To Dev |
| UX Review   | In Dev | `1241` | Back To Dev |
| In QA       | In Dev | `1251` | Back To Dev |

#### Global transitions (available from any state)

| To        | ID     | Name                | Notes                                                      |
| --------- | ------ | ------------------- | ---------------------------------------------------------- |
| Open      | `841`  | To Backlog          | Conditional — may not be available on every issue.         |
| Cancelled | `1191` | Confirm Cancelation | `hasScreen: true` — prompts for confirmation / resolution. |
| Refined   | `1221` | Refined             |                                                            |

### Epic

No `Refined`/`To Do`/`Code Review` flow — Epics use a much simpler workflow.

#### Forward transitions

| From        | To          | ID   | Name           |
| ----------- | ----------- | ---- | -------------- |
| Open        | In Progress | `51` | To In Progress |
| In Progress | Closed      | `61` | To Closed      |

#### Global transitions

| To        | ID   | Name                 | Notes              |
| --------- | ---- | -------------------- | ------------------ |
| Open      | `81` | Open                 |                    |
| Hold      | `91` | Hold                 |                    |
| Cancelled | `71` | Confirm Cancellation | `hasScreen: true`. |

Hold and Closed states only expose the globals above — there's no status-specific `Reopen` transition; use `81` (Open) to send back to Open.

### Task

#### Forward transitions

| From        | To          | ID   | Name       |
| ----------- | ----------- | ---- | ---------- |
| Open        | To Do       | `71` | To Do      |
| To Do       | In Progress | `51` | Start Task |
| In Progress | Closed      | `61` | Close Task |

#### Global transitions

| To    | ID   | Name       | Notes                                           |
| ----- | ---- | ---------- | ----------------------------------------------- |
| Open  | `31` | To Backlog | Conditional — not available from Open itself.   |
| To Do | `71` | To Do      | Doubles as the Open → To Do forward transition. |

No Hold or Cancelled state in the Task workflow.

### Sub-task

#### Forward transitions

| From        | To          | ID    | Name        |
| ----------- | ----------- | ----- | ----------- |
| Open        | To Do       | `71`  | Ready To Do |
| To Do       | In Progress | `91`  | Start Task  |
| In Progress | Closed      | `101` | Close Task  |

#### Global transitions

| To      | ID   | Name        | Notes                                                                                   |
| ------- | ---- | ----------- | --------------------------------------------------------------------------------------- |
| Open    | `31` | Open        | Conditional.                                                                            |
| To Do   | `71` | Ready To Do | Conditional — doubles as Open → To Do.                                                  |
| Deleted | `41` | Deleted     | Conditional. Sub-tasks have a `Deleted` end-state instead of `Closed` for cancellation. |

### Initiative

Uses uniquely Initiative-level statuses (`Discovery`, `GA`, `Write-Off`, `Remapped`) that don't appear in the other workflows. This template does not map the full forward path — query `getTransitionsForJiraIssue` against the specific Initiative when needed. Globals: `31` Open, `41` Hold, `61` Remapped, `71` Write-Off, `361` Discovery.

## Instructions

Optional free-form notes for the LLM. Anything here overrides the calling skill's defaults. Examples:

- Title (summary) should be formatted as `<project-name>: <gitmoji> <title>` (e.g. `templates-ms: ♻️ refactor pipeline`).
- Keep summaries to one short sentence — execs read these.
- Always include `## Acceptance Criteria` and `## Test Plan` sections in the description.

Delete the examples that don't apply. Delete this whole section if you don't need any of it.
