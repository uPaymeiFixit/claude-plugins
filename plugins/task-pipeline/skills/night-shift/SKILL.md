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
- Before starting each substantial task, call the Skill tool with `task-pipeline:orchestrate-task` and follow the stages it loads. Do not approximate the pipeline from its one-line description — the plan-review loop and the adversarial diff review exist only in the skill body, and skipping the invocation means skipping them. Re-invoke whenever the stages are no longer in context (e.g. after compaction). Its orchestrator stance holds for the whole shift, even between tasks.
- Keep a scratchpad file of decisions made and `date`-stamped tasks worked — it survives auto-compaction and feeds the handoff summary.

## Time

- **Never guess the time** from previous messages — you are an LLM and have no way of knowing how much time has passed. Check with `date`.
- Return time: from arguments, default **6am**. **Work until then by default.** Finishing a clean deliverable is not a reason to stop — pull the next task. Before concluding you're done, run `date`: more than an hour left means you're not done (you finish tasks in a fraction of your estimates, so the return time isn't a hard stop either).
- Stopping early takes a hard justification, not "this is a good stopping point": either every remaining task is truly blocked on a documented question you've already researched to a dead end, or the pile already exceeds what the user can review in one sitting (many branches AND large diffs). A few clean branches is neither.

## Handoff summary

The handoff is the shift's **last action, written once** — never at a mid-shift "stopping point" you'll keep working past (a stale artifact claiming completion is worse than none). Until then, everything goes in the scratchpad; keep it complete enough that the handoff — or a fresh session — could be reconstructed from it.

Write it by calling the Skill tool with `task-pipeline:summarize-task` (same rule: load the body, don't work from the description), delivered as an artifact rather than a chat reply.
