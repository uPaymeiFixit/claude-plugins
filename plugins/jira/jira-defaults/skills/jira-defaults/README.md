# jira-defaults

Owns your Jira defaults — projectKey, parent, assignee, dev team, transition IDs, custom fields, and any free-form `## Instructions` — stored in a single user-local file. Other Jira skills invoke this to load defaults; you can also invoke it directly to view, edit, or re-discover them.

## Usage

### Auto (called by other skills)

Skills like `create-jira-item` invoke this before they touch Jira. Nothing for you to do.

### As a slash command

```
/jira-defaults
```

(no args — asks what you want to view or change)

```
/jira-defaults change projectKey to PROJ
```

```
/jira-defaults re-run setup
```

### As a natural-language skill

> change my Jira defaults

> show me my Jira defaults

> update my Jira projectKey

> re-run Jira setup

## What it does

1. **Loads** `$XDG_DATA_HOME/jira-defaults.md` (fallback `~/.local/share/jira-defaults.md`) and hands its contents to the calling skill (or to you).
2. **Bootstraps on first run** — if the file is missing, walks the Atlassian MCP / `acli jira` to discover what it can, asks you for the rest, and writes the file using [defaults.template.md](defaults.template.md) as the shape. See [SETUP.md](SETUP.md).
3. **Edits in-place** when invoked directly. View defaults, change a single field, or edit `## Instructions` without re-running full setup. Re-running setup is available but requires confirmation — it overwrites the file.

## Tooling

- **Atlassian MCP server** is preferred. `acli jira` works as a fallback for most calls.

## Configuration

Everything lives in one file at `$XDG_DATA_HOME/jira-defaults.md`. The cloudId is hard-coded in the template — change it to your org's Atlassian hostname if you're forking this.
