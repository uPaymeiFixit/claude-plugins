---
name: create-jira-item
description: 'Create a Jira work item / ticket with sensible defaults.'
when_to_use: 'Use whenever creating a Jira item.'
argument-hint: '[work item title (e.g. "Enable strict linting")]'
---

# Create Jira work item

This skill is a thin orchestrator. Field values come from the `jira-defaults` skill, the conversation context, or `$ARGUMENTS` — in that order of precedence (later sources override earlier).

If the Atlassian MCP server isn't connected, suggest the user install it and stop.

## Steps

1. **Load defaults.** Invoke the `jira-defaults` skill via the Skill tool. It returns field defaults, transition IDs, custom field mappings, and any `## Instructions`. If the skill isn't installed, stop and tell the user to install `jira-defaults@uPaymeiFixit-claude-plugins`.

2. **Determine the title.** First non-empty source wins:
    1. `$ARGUMENTS`.
    2. `AskUserQuestion` with 3 generated suggestions; user can pick one or write their own via "Other".

3. **Resolve all other fields.** For each field the create call needs (issue type, projectKey, parent, assignee, Dev Team, labels, etc.), use this precedence: explicit user input or `$ARGUMENTS` > inferable from context (e.g. an issue type implied by the title) > defaults from `jira-defaults`. Apply any `## Instructions` from the defaults file as binding overrides.

4. **Describe the planned item to the user before creating it.**

5. **Create the issue** via the Atlassian MCP `createJiraIssue`. Use `contentFormat: markdown` for the description.

6. **Transition.** If the defaults file specifies a `target-status` and it's not the issue's current state, walk the workflow there using the transition tables in the defaults file. If `target-status` is "no default — ask each time" (or absent), ask the user.

7. **Report.** Provide:
    - Issue key and URL
    - Summary
    - Current status
