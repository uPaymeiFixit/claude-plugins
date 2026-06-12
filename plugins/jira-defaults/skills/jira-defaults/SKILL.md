---
name: jira-defaults
description: "Loads or edits Jira defaults — projectKey, parent, assignee, dev team, transition IDs, custom fields, free-form instructions — stored in a single user-local file."
when_to_use: 'Use when another skill needs Jira field defaults, transition IDs, or custom field mappings — invoke before creating, updating, or transitioning a Jira issue. Or when the user wants to view, change, or re-discover their Jira defaults (trigger phrases: "change my Jira defaults", "edit jira defaults", "update my projectKey", "re-run jira setup").'
argument-hint: '[optional: what to view or change, e.g. "show my defaults" or "change projectKey to PROJ"]'
---

# Jira defaults

Defaults file: `$XDG_DATA_HOME/jira-defaults.md` (fallback `~/.local/share/jira-defaults.md`).

## Mode

- **Auto mode** — another skill invoked you to load defaults. Run "Load defaults" below and return the contents.
- **User mode** — the user invoked you directly (slash command or natural language). Run "Load defaults", then "Edit defaults".

## Load defaults

1. Try `$XDG_DATA_HOME/jira-defaults.md`, then `~/.local/share/jira-defaults.md`. If either resolves, you're done — its contents are the loaded defaults.
2. If neither path exists, read `${CLAUDE_SKILL_DIR}/SETUP.md` and follow it to discover and write the file. Then re-read the file.

## Edit defaults

User mode only. Determine intent:

- If `$ARGUMENTS` names a specific change (e.g. "change projectKey to PROJ", "set parent to PROJ-9000"), apply it: locate the field in the file, edit it in place, confirm the change.
- If the user asks to view defaults, show them the relevant section.
- If the user asks to re-run setup or rediscover everything, **confirm first** — re-running SETUP.md overwrites the file and loses any manual edits, including the `## Instructions` section. Only proceed on explicit confirmation.
- Otherwise, ask the user what they want to change, with `AskUserQuestion`. Offer: view all defaults, edit a specific field, edit `## Instructions`, re-run full setup.

Edit the file in place with the Edit tool. After any change, show the user what was updated.
