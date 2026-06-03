# claude-plugins

Personal marketplace of generic Claude Code skills. Follows the [official plugin layout](https://code.claude.com/docs/en/plugins).

## Layout

```
.claude-plugin/marketplace.json         # registry — every plugin must be listed here
plugins/<plugin>/skills/<skill>/
    SKILL.md                            # required — what Claude loads
    README.md                           # required — what humans read on GitHub
    scripts/                            # optional — bundled executables
```

A plugin directory may also contain `commands/`, `agents/`, `hooks/`, `.mcp.json`, or a `.claude-plugin/plugin.json` manifest. Plugin and inner skill dirs typically share a name for single-skill plugins.

## Adding a new plugin

1. Create `plugins/<plugin>/skills/<skill>/SKILL.md` with YAML frontmatter (`name`, `description`). Apply the `write-claude-tooling` skill while authoring — terse, imperative, no padding.
2. Write `plugins/<plugin>/skills/<skill>/README.md` following the conventions below.
3. Register the plugin in [.claude-plugin/marketplace.json](.claude-plugin/marketplace.json) under `plugins`, alphabetically:
    ```json
    {
        "name": "<plugin>",
        "description": "<one line — matches the README tagline>",
        "source": "./plugins/<plugin>",
        "strict": false
    }
    ```
4. Add a row to the **Available skills** table in [README.md](README.md).
5. Commit and push.

## README conventions

Plugin READMEs generally follow this shape. See [notify-blame](plugins/notify-blame/skills/notify-blame/README.md) and [commit-and-mr](plugins/commit-and-mr/skills/commit-and-mr/README.md) for canonical examples. This is not a requirement, but a guideline.

```markdown
# <plugin-name>

<One- or two-sentence tagline — what it does, in plain language. Same wording as marketplace.json.>

### Old way
<mermaid flowchart of the manual steps the skill replaces>

### New way
<mermaid flowchart showing one command → ✅ outcome>

## Usage
<Slash command form + natural-language trigger phrases as blockquotes.
Skip this section's invocation block if the skill isn't user-invocable —
see person-to-user-map.>

## What it does
<Numbered list. Each step starts with a verb. Optionally reference the
script names and MCP tools the skill calls — or keep it user-facing.>

## Use cases
<2–4 H3 sub-sections, each with a code block and one-paragraph explanation.
Cover the golden path plus the interesting edge cases.>

## Tooling
<Bulleted list of external dependencies: CLIs, MCP servers, bundled scripts.
Mark optional ones explicitly.>
```

### Style notes

- **Tagline matches the marketplace.** The first line of the README, the marketplace.json `description`, and the row in the root README table should say the same thing in the same words.
- **Old way / New way diagrams are the hook.** They sell the skill in one screen. Skip them only for non-user-invocable utility skills (e.g. `person-to-user-map` uses a cache-flow diagram instead).
- **Cross-link sibling skills** with relative paths (`../../../<other-plugin>/skills/<other-skill>/README.md`) when one skill calls another.
- **Show, don't tell.** Use code blocks for invocations, blockquotes for trigger phrases, tables/bullets over prose.
- **Lean READMEs are fine.** Not every README needs every section. A user-facing README may omit script-name references and `Use cases`, use `Requirements` in place of `Tooling`, or run a single explanatory diagram instead of Old way / New way — when that reads better for a human deciding whether to use the skill. `create-workspace` is the lean example; `commit-and-mr` the full-template one.

## Authoring the SKILL.md

Skim the [official skills documentation](https://code.claude.com/docs/en/skills.md) before authoring — it covers frontmatter fields, file discovery, and the conventions you're expected to follow (e.g. referencing bundled scripts via `${CLAUDE_SKILL_DIR}` rather than hard-coded paths).

Skills in this repo are LLM-consumed, not human-consumed. Apply the [write-claude-tooling](plugins/write-claude-tooling/skills/write-claude-tooling/README.md) rules: only document what Claude wouldn't otherwise do, point to scripts over describing them, keep the body tight. The README explains the skill to a human; the SKILL.md tells Claude how to run it.

### Frontmatter conventions

None of these are strict requirements — guidelines based on what the existing skills converged on.

| Field | When to use |
|---|---|
| `name` | Always. Matches the skill directory name. |
| `description` | Always. One line, matches the marketplace.json `description` and the README tagline. |
| `when_to_use` | When the skill is model-invocable. Imperative ("Use when..."); include literal trigger phrases in quotes so Claude can pattern-match user intent. |
| `argument-hint` | When the skill is invokable as a slash command with positional/keyword args (e.g. `[branch-name] [jira=<KEY>\|jira=none]`). |
| `allowed-tools` | When you want a tight allowlist. Use `Bash(<cmd> *)` patterns for specific CLIs, full MCP tool names, and include `Skill` if the skill delegates to others. |
| `disable-model-invocation: true` | When the skill should run only as an explicit slash command, never auto-triggered by phrasing. |
| `user-invocable: false` | When the skill is called only by other skills (e.g. `person-to-user-map`) and shouldn't show in `/`-menus. |
| `paths` | When the skill should auto-activate on file-path matches (e.g. `**/SKILL.md`). |

### Stateful / configuration-based skills

If the skill persists state across runs — a cache, user config, defaults — look at the external `jira-defaults` skill as a reference. The shape that's worked well:

- Single file under `$XDG_DATA_HOME/<skill-name>.{md,yaml}` (fallback `~/.local/share/`). One file beats a directory tree for hand-editing.
- A separate `SETUP.md` for first-run bootstrap, invoked only when the file is missing — keeps the SKILL.md tight.
- **Auto mode vs User mode** branch at the top of SKILL.md: auto when another skill invokes it (just load and return), user when invoked directly (load, then offer view/edit/re-discover).
- Edit the file in place with the Edit tool. Confirm before any destructive op (e.g. re-running setup that would overwrite manual edits).

`person-to-user-map` is the in-repo example of the cache flavor.

