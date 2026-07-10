---
name: night-shift
description: Work autonomously overnight — research, plan, experiment, and land straightforward features on separate branches — then deliver a brutally concise morning summary.
when_to_use: 'Use when the user is signing off and wants autonomous work until they return. Trigger phrases: "night shift", "I''m going to bed", "work overnight", "see you in the morning", "I''ll be back at <time>".'
argument-hint: '[return-time] [tasks ...]   # default return time: 6am'
---

# night-shift

The user is asleep or away: no answers, no supervision, no one to compact your context. Everything below follows from that.

## Scope

Do whatever work you can autonomously: research, planning, experiments — even land features if they're straightforward enough. Work the given tasks if any; otherwise you have full autonomy to decide what to do. The shift is a budget to spend, not a checklist to finish early.

## When you hit a question

Most "ask the user" moments are really "haven't researched yet" — grep, spawn a read-only investigator, prototype a branch. "Risky" or "uncertain" is a signal to research, not to defer. If a real question survives research, either:

1. Document it, summarize it for the user's return, and move on to another task; or
2. Research, plan, and execute (to an appropriate degree) each likely design fork — often easiest as one branch per direction — so the user's answer on return just picks a branch that already exists.

## Working rules

- Work in separate branches to mitigate risk. The user reviews and merges on return.
- If commit signing is unavailable (1Password locked), use `git -c commit.gpgsign=false`.
- Be suspicious of possibly wedged scripts.
- You are purely the orchestrator for this shift. Manage context by delegating: planning to a high-reasoning model, execution to a cheaper model. Keep raw file contents and long logs out of your own context.
- Keep a scratchpad file of decisions made and `date`-stamped tasks worked — it survives auto-compaction and feeds the handoff summary.

## Time

- **Never guess the time** from previous messages — you are an LLM and have no way of knowing how much time has passed. Check with `date`.
- Return time: from arguments, default **6am**. **Work until then by default.** Finishing a clean deliverable is not a reason to stop — pull the next task. Before concluding you're done, run `date`: more than an hour left means you're not done (you finish tasks in a fraction of your estimates, so the return time isn't a hard stop either).
- Stopping early takes a hard justification, not "this is a good stopping point": either every remaining task is truly blocked on a documented question you've already researched to a dead end, or the pile already exceeds what the user can review in one sitting (many branches AND large diffs). A few clean branches is neither.

## Handoff summary

Write a shift-summary artifact including (but not limited to): what you did, branches created, design-fork questions with your recommendation. Brutally concise — think "voice mode". The reader is a standard developer who was NOT standing over your shoulder the whole shift: no internal variables, no file-discovery blow-by-blow, no lingo you invented along the way. Straight to the point.
