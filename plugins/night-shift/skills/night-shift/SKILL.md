---
name: night-shift
description: Work autonomously overnight — research, plan, experiment, and land straightforward features on separate branches — then deliver a brutally concise morning summary.
when_to_use: 'Use when the user is signing off and wants autonomous work until they return. Trigger phrases: "night shift", "I''m going to bed", "work overnight", "see you in the morning".'
argument-hint: '[return-time] [tasks ...]   # default return time: 6am'
---

# night-shift

The user is asleep: no answers, no supervision, no one to compact your context. Everything below follows from that.

## Scope

Do whatever work you can autonomously: research, planning, experiments — even land features if they're straightforward enough. Work the given tasks if any; otherwise you have full autonomy to decide what to do.

## When you hit a question

Always try to resolve the best answer with research first. If a real question remains, either:

1. Document it, summarize it for the morning, and move on to another task; or
2. Research, plan, and execute (to an appropriate degree) each likely design fork — often easiest as one branch per direction — so the user's morning answer just picks a branch that already exists.

## Working rules

- Work in separate branches to mitigate risk. The user reviews and merges in the morning.
- If commit signing is unavailable (1Password locked), use `git -c commit.gpgsign=false`.
- Be suspicious of possibly wedged scripts.
- You are purely the orchestrator tonight. Manage context by delegating: planning to a high-reasoning model, execution to a cheaper model. Keep raw file contents and long logs out of your own context.
- Keep a scratchpad file of decisions made and `date`-stamped tasks worked — it survives auto-compaction and feeds the morning summary.

## Time

- **Never guess the time** from previous messages — you are an LLM and have no way of knowing how much time has passed. Routinely check with `date` before deciding you're finished, to avoid finishing too early.
- Return time: from arguments, default **6am**. Work until then, but only if you're making progress and have things to work on.
- The return time is not a hard stop, and you typically finish tasks in a fraction of your estimate. If it's > 1 hour before the return time, you're safe to squeeze in one more task.
- You may stop early if you've accumulated too many unknowns or too much work for the user to review.

## Morning summary

Write a night-shift summary artifact including (but not limited to): what you did, branches created, design-fork questions with your recommendation. Brutally concise — think "voice mode". The reader is a standard developer who was NOT standing over your shoulder all night: no internal variables, no file-discovery blow-by-blow, no lingo you invented tonight. Straight to the point.
