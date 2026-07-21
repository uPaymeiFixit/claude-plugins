---
name: orchestrate-task
description: Run a medium-sized task through a model-tiered subagent pipeline — Opus plans, Fable reviews the plan, Sonnet executes, and a bundled adversarial-review workflow verifies the diff.
when_to_use: 'Use when picking up a task likely to run more than ~15 turns or span many files — a feature, refactor, or migration too big to do well in one context. Trigger phrases: "orchestrate this", "orchestrate task", "task pipeline".'
argument-hint: '[task description]'
---

# orchestrate-task

You are the orchestrator. Delegate everything heavy: subagents read and write; you route. Keep raw file contents, long logs, and code detail out of your own context. Track the stages with TodoWrite.

Model tiering: **Opus** = research + synthesis, **Fable** = review, **Sonnet** = execution swarm. Everything below is a default with a history of working well, not a hard requirement. If the user asks you not to use Fable, use Opus in its place.

## Stage 1 — Plan (`model: "opus"`)

Spawn a planning agent: deep research, then a high-level architectural plan. No code detail yet — the plan is written to be reviewed in Stage 2. Include multiple options when a real design fork exists.

## Stage 2 — Review the plan (`model: "fable"`)

Spawn one review agent over the plan. Fable is expensive and extremely good at seeing the whole scope end-to-end — give it full context and instruct it to be adversarial about every plan and option. It must not do its own deep research: if it needs more information, it returns questions and you spawn another Opus agent to answer them. Loop Stage 1 ↔ 2 until plan and reviewer reach consensus.

## Stage 3 — Detail (`model: "opus"`)

Spawn an agent to turn the agreed plan into execution detail: concrete files, ordering, and — where safe — a split into independent units that can run in parallel. It does the legwork for Stage 4.

## Stage 4 — Execute (`model: "sonnet"`)

Spawn executors over the detailed plan(s) — in parallel when the split allows. Executors implement exactly what is specified. On a significant issue or decision, an executor must not improvise: it reports back, and you route the question to a plan agent — or restart from Stage 1 if the plan itself is wrong.

## Stage 5 — Verify

1. Run the project's own checks (tests, build; the `verify` skill if available).
2. Run the bundled adversarial-review workflow over the task's diff: invoke the Workflow tool with `scriptPath: ${CLAUDE_SKILL_DIR}/workflows/adversarial-review.js` (this skill's base directory) and args `{ repoPath: "<abs repo path>", diffCmd: "git -C <repoPath> diff <base>...<branch>", context: "<one paragraph: what the task was>" }`. Every git call in `diffCmd` must be spelled `git -C <repoPath>` or the script aborts. Optional args: `dimensions`, `findModel`, `verifyModel`, `branchGlobs` — documented at the top of the script.
3. If the Workflow tool is unavailable, run the same shape with Agent calls: one Sonnet finder per dimension over the diff, then one adversarial verifier per finding whose default verdict is REFUTED.
4. Route CONFIRMED findings back to Stage 4 executors to fix; re-run the review until nothing is confirmed.
