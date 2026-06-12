# claude-plugins

A personal marketplace of generic [Claude Code](https://code.claude.com) skills.

## Available skills

| Plugin | What it does |
|---|---|
| [commit-and-mr](plugins/commit-and-mr/skills/commit-and-mr/) | Commit, push, and open a GitLab merge request with blame-derived reviewers. |
| [create-jira-item](plugins/create-jira-item/skills/create-jira-item/) | Create a Jira work item / ticket with sensible defaults. |
| [create-workspace](plugins/create-workspace/skills/create-workspace/) | Stitch several existing repos into one Claude Code context for cross-repo feature work, then publish the workspace to GitLab. |
| [full-feature-workflow](plugins/full-feature-workflow/skills/full-feature-workflow/) | End-to-end feature workflow: create a Jira item (if needed), implement the change, wait for review, commit & open MR, and notify blame authors. |
| [jira-defaults](plugins/jira-defaults/skills/jira-defaults/) | Loads or edits Jira defaults — projectKey, parent, assignee, dev team, transition IDs, custom fields, free-form instructions — stored in a single user-local file. |
| [leeroy-jenkins](plugins/leeroy-jenkins/skills/leeroy-jenkins/) | Ship a GitLab MR end-to-end — approve, merge, update Fixed in Build, promote the Jira story, and play the lab deploy jobs. |
| [notify-blame](plugins/notify-blame/skills/notify-blame/) | DM every git blame author on Slack when you touch their code, with a personalized summary. |
| [person-to-user-map](plugins/person-to-user-map/skills/person-to-user-map/) | Cache mapping people to their Slack/GitLab/Jira IDs. Used by other skills to avoid repeated API lookups. |
| [write-claude-tooling](plugins/write-claude-tooling/skills/write-claude-tooling/) | Token-efficient authoring rules for SKILL.md, CLAUDE.md, slash commands, and other LLM-consumed docs. |

## Getting started

### Add the marketplace

In Claude Code, run:

```
/plugin marketplace add git@github.com:uPaymeiFixit/claude-plugins.git
```

### Install a plugin

```
/plugin install <plugin-name>@uPaymeiFixit-claude-plugins
```

Or run `/plugin` to browse and install via the **Discover** tab. After install, run `/reload-plugins` to activate.

## Repository structure

This marketplace follows the [official Claude Code plugin layout](https://code.claude.com/docs/en/plugins): each plugin is its own directory, with skills, commands, hooks, and agents grouped under it.

```
claude-plugins/
  .claude-plugin/
    marketplace.json              # Plugin registry
  plugins/
    commit-and-mr/
      skills/
        commit-and-mr/
          SKILL.md
    notify-blame/
      skills/
        notify-blame/
          SKILL.md
    person-to-user-map/
      skills/
        person-to-user-map/
          SKILL.md
    write-claude-tooling/
      skills/
        write-claude-tooling/
          SKILL.md
```

A plugin's directory may also contain `commands/`, `agents/`, `hooks/`, `.mcp.json`, and a `.claude-plugin/plugin.json` manifest. None of these plugins use them yet.

## Contributing

1. **Create the plugin directory** at `./plugins/<plugin-name>/skills/<skill-name>/`. The plugin directory and the inner skill directory don't have to share the same name, but for single-skill plugins it's conventional.

2. **Add a `SKILL.md`** with YAML frontmatter:

   ```markdown
   ---
   name: your-skill
   description: A short description of what this skill does.
   ---

   Instructions for Claude when this skill is invoked...
   ```

3. **Add an entry to `marketplace.json`** under `plugins`:

   ```json
   {
       "name": "your-skill",
       "description": "A short description of what this skill does.",
       "source": "./plugins/your-skill",
       "strict": false
   }
   ```

4. Commit and push.

For guidance on writing skills, see the [official plugins documentation](https://code.claude.com/docs/en/plugins) and the [`write-claude-tooling`](plugins/write-claude-tooling/skills/write-claude-tooling/) skill in this marketplace.
