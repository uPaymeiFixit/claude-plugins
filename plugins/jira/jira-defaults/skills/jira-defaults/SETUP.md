# Setup: discover Jira defaults

Run when `jira-defaults` can't find the defaults file at `$XDG_DATA_HOME/jira-defaults.md` (fallback `~/.local/share/jira-defaults.md`).

The goal is to write that file. Use the Atlassian MCP server where possible, fall back to `acli jira` (run `acli --help` to confirm it's installed), and ask the user only what can't be discovered or inferred.

## Prerequisites

The Atlassian MCP server should be connected. If it isn't, check whether `acli jira` is available — it can substitute for most calls below. If neither is available, stop and tell the user to install one.

## Pre-flight: load tool schemas

Most tools below are deferred. Load all needed schemas in a single `ToolSearch` call to avoid round-trips:

```
ToolSearch query: "select:mcp__claude_ai_Atlassian__atlassianUserInfo,mcp__claude_ai_Atlassian__getVisibleJiraProjects,mcp__claude_ai_Atlassian__getJiraProjectIssueTypesMetadata,mcp__claude_ai_Atlassian__getJiraIssueTypeMetaWithFields,mcp__claude_ai_Atlassian__getJiraIssue,mcp__claude_ai_Atlassian__searchJiraIssuesUsingJql,AskUserQuestion"
```

If `acli jira` is the fallback path skip the MCP names.

## Picker rule

When you offer the user a picker with an "Other" option and they type a free-text answer, fuzzy-match it against the full known list.

- 1 reasonable match → accept silently.
- 2+ reasonable matches → re-ask with just the matching options (no "Other" this time).
- 0 matches → accept the literal value.

## Steps

1. **Resolve the file path.**

   `path = ${XDG_DATA_HOME:-$HOME/.local/share}/jira-defaults.md`. Create the parent directory if missing.

2. **Load recent activity to seed recommendations.**

   Run `searchJiraIssuesUsingJql` with `assignee = currentUser() ORDER BY created DESC` (limit ~20). Derive:
   - **Most-frequent projectKey** → recommend first in the project picker, marked `(Recommended)`.
   - **Most-frequent Dev Team value** → recommend first in the Dev Team picker.
   - **Most-recent parent epic** if consistent → suggest as the default parent (with a "Skip" option).
   - **Common labels** → surface as candidates for the `labels` rule if any stand out.

   If the user has no recent activity, fall back to alphabetical ordering for pickers.

3. **Discover the assignee.**
   - MCP: `atlassianUserInfo` → use the display name and accountId of the current user.

4. **Discover the projectKey.**
   - MCP: `getVisibleJiraProjects` (action: `view`) lists projects.
   - Use `AskUserQuestion`. Put the recommended project from step 2 first, then the next most-likely candidates, with an "Other" escape. Apply the picker rule above for free-text answers.

5. **Discover required custom fields.**

   > ⚠️ `getJiraIssueTypeMetaWithFields` can return a very large payload (~140K chars on big orgs) and will exceed your token budget if read directly. Plan for it: spawn a `general-purpose` Agent to read the tool-result file and extract just (a) the required custom fields, (b) any required single-select field's `allowedValues`, and (c) any other custom fields whose name matches "Sprint" / "Fixed in Build" / etc. Don't try to ingest the raw response into your context.
   - MCP: `getJiraProjectIssueTypesMetadata` for the chosen project, then `getJiraIssueTypeMetaWithFields` for `Story` (or whatever the user's default issue type is).
   - For each required custom field, list the allowed values and use `AskUserQuestion` to let the user pick. Use the recommendation from step 2 as the first option for Dev Team. Record the field ID, label, chosen value, and chosen value's display name.

6. **Discover the parent.**

   Use the recent-parent recommendation from step 2 if available. Validate any user-provided key with `getJiraIssue`. "Skip" / "no default — ask each time" is a valid choice.

7. **Discover the target-status.**

   Pure preference. Ask the user via `AskUserQuestion` with options like `To Do`, `In Progress`, `Code Review`, plus `Other`. "No default — ask each time" is a valid choice.

8. **Workflow transitions — already in the template.**

   The transition tables in `defaults.template.md` are pre-populated with Paciolan's actual workflow IDs (Story / Bug / Spike, Epic, Task, Sub-task, Initiative). Don't discover them. Don't call `getTransitionsForJiraIssue`. Just write the tables through as-is.

   If a user later reports that a transition fails (e.g. their team forked the workflow), we can add discovery-as-fallback at that point.

9. **Ask about free-form instructions.**

   Use `AskUserQuestion` to offer the user a chance to add custom instructions (summary style, formatting rules, banned conventions like gitmoji, required description sections, etc.). The template's `## Instructions` section ships with examples — show the user the examples for inspiration, capture any they want to keep verbatim, and drop the rest. If they decline everything, omit the section entirely.

10. **Write the file.**

    Use `${CLAUDE_SKILL_DIR}/defaults.template.md` as the structure. Substitute discovered values into the `## Defaults` and `### Custom Fields` tables. Leave the `## Workflow Transitions` section unchanged. Write to the resolved path.

11. **Confirm.**

    Tell the user:
    - The path of the file written.
    - Which fields were auto-discovered, recommended, or asked.
    - That the workflow transitions came from the template (not discovered).
    - That they can edit the file directly to tweak defaults later.
