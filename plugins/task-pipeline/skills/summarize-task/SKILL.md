---
name: summarize-task
description: Summarize finished work for a reader who wasn't watching — outcome first, plain names, no session-invented jargon.
when_to_use: 'Use when reporting finished work back to the user — especially work they did not oversee: an orchestrated pipeline, an overnight run, a long agentic session. Trigger phrases: "summarize the task", "summarize what you did", "handoff summary", "what did you do while I was gone".'
---

# summarize-task

Summarize the work for a standard developer who was NOT standing over your shoulder. They never saw the session, so any name or shorthand coined during it means nothing to them. Deliver as the final chat reply unless the user or invoking skill asks for an artifact.

## Voice

- **No invented jargon.** Name things by what they are — the literal branch, file, function, behavior — never by a label coined mid-session ("the oracle", "phase 2b", "the salvage path"). Before writing, re-derive the plain description of anything the session nicknamed.
- **Final state, not the story.** Describe where things ended, never the path there. Anything raised and then resolved mid-session — a bug a review caught and you fixed, an approach you tried and replaced — does not appear at all. No "then / but then / after the review" narration. An intermediate event earns a mention only if it still affects the reader: an unresolved issue, or a decision they may want to revisit.
- **Executive altitude, not a diff walkthrough.** What changed and why it matters. No internal variable names, no file-discovery blow-by-blow, no dead ends unless a dead end is the finding.
- **Brutally concise.** Lead with the outcome. Plain words over big ones. The reader pulls detail by asking — don't push it preemptively.

## Contents

Include what applies to what the task actually produced:

- **Outcome** — what now works or exists that didn't before, and where it lives (branch, MR, files). Results, not effort.
- **Decisions made on the user's behalf** — one line each, with the why.
- **Open questions / design forks** — each with your recommendation, not just the question.
- **File manifest** — every file created, modified, or deleted, one line each: what it does (created), what changed semantically (modified), why it's gone (deleted).
- **Unverified claims** — anything untested or unrun, stated plainly.
- **Memory changes** — any persistent memory created, updated, or deleted during the task: the file and what it now says. Omit the section if none.
