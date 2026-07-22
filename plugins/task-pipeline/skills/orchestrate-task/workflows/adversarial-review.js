export const meta = {
  name: 'adversarial-review',
  description: 'Adversarial review of a diff: fan out finders across dimensions, then adversarially verify each finding before reporting.',
  whenToUse: 'Reviewing a completed change for real defects. Findings survive only if a verifier reconstructs the failure against the actual source — the default verdict is REFUTED.',
  phases: [
    { title: 'Scope', detail: 'establish the diff under review; optional sibling-branch combine check' },
    { title: 'Find', detail: 'independent finders, one per dimension, over the diff' },
    { title: 'Verify', detail: 'adversarially confirm/refute each finding against the source' },
  ],
}

// args (repoPath REQUIRED, rest optional):
//   { repoPath: "/abs/path/to/repo",                  // anchors EVERY git command + file read to the
//                                                      // repo under review. Omit it and the review
//                                                      // silently runs in the workflow process's cwd
//                                                      // (wrong repo) — so it hard-aborts instead.
//     diffCmd: "git -C <repoPath> diff main...<branch>",  // EVERY git call in it must spell
//                                                      // `git -C <repoPath>`. Validated, not rewritten —
//                                                      // an unanchored diffCmd hard-aborts.
//     context: "<what the change is + standing rules for the reviewers>",
//     dimensions: ["correctness","edge-cases","regression","simplification"], // finder lenses
//     findModel: "sonnet", verifyModel: "sonnet",      // model per phase
//     branchGlobs: ["fix/*","feat/*"] }                // pass to ALSO check for unmerged sibling
//                                                      // branches that should be combined into ONE
//                                                      // review (N branches reviewed together see the
//                                                      // fixes interact). Omit to skip the check.
// Tolerate args arriving as a JSON STRING (a known Workflow footgun — a stringified object reaches
// the script as one string, so `a.repoPath` would be undefined and everything mis-fires). Parse it.
let a = args || {}
if (typeof a === 'string') {
  try { a = JSON.parse(a) } catch { a = {} }
}
const DIMENSIONS = a.dimensions && a.dimensions.length
  ? a.dimensions
  : ['correctness', 'edge-cases', 'regression', 'simplification']
const BRANCH_GLOBS = a.branchGlobs && a.branchGlobs.length ? a.branchGlobs : []
const FIND_MODEL = a.findModel || 'sonnet'
const VERIFY_MODEL = a.verifyModel || 'sonnet'
// repoPath anchors EVERY git command and file read to the repo under review. Without it, a bare
// `git branch` runs in the workflow process's cwd — which is NOT necessarily the repo the diffCmd
// points at, so the run silently reviews the wrong repo. Prefer the explicit arg; the regex on
// diffCmd is a fragile fallback that only fires when diffCmd literally spells `git -C <path>`.
const REPO_PATH = a.repoPath ||
  ((a.diffCmd || '').match(/git\s+-C\s+(\S+)/) || [])[1] || null
if (!REPO_PATH) {
  // HARD STOP, not a warning. The whole failure class (reviewing the wrong repo) comes from
  // running git unanchored in the workflow process's cwd. Without a known repo root there is no
  // safe default — refuse rather than silently review whatever happens to be the cwd.
  log('❌ adversarial-review: no repoPath given and none derivable from diffCmd (needs a literal ' +
    '`git -C <path>`). Refusing to run unanchored — pass repoPath explicitly. Aborting.')
  return { aborted: true, reason: 'no repoPath — refused to run unanchored (would risk wrong repo)' }
}
const GIT = `git -C ${REPO_PATH}`
// VALIDATE, don't rewrite. String-munging a caller's diffCmd to inject `-C` is fragile —
// compound `git … && git …` (only first anchored), `$&`/`$1` in the path (replacement-string
// mis-substitution), an already-`git -C <OTHER>` that silently wins. So instead: require the
// caller's diffCmd to ALREADY be anchored to THIS repoPath, and hard-abort otherwise.
// Deterministic, no silent-wrong.
let DIFF_CMD
if (!a.diffCmd) {
  DIFF_CMD = `${GIT} diff`
} else {
  // EVERY `git` token in the diffCmd must be `git -C <repoPath>` — catches a compound
  // `git -C /A diff … && git diff …` where only the first is anchored (the second would run in cwd).
  const gitTokens = a.diffCmd.match(/(^|\s)git(\s|$)/g) || []
  const anchoredTokens = a.diffCmd.match(new RegExp(`(^|\\s)git\\s+-C\\s+${REPO_PATH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'g')) || []
  if (gitTokens.length > 0 && gitTokens.length === anchoredTokens.length) {
    DIFF_CMD = a.diffCmd // every git invocation is anchored to THIS repoPath
  } else {
    log(`❌ diffCmd is not fully anchored to repoPath. EVERY git invocation must spell ` +
      `\`git -C ${REPO_PATH} …\` so none can run in the workflow's cwd. Got ${gitTokens.length} git ` +
      `token(s), ${anchoredTokens.length} anchored. diffCmd: ${a.diffCmd}. Aborting.`)
    return { aborted: true, reason: 'diffCmd not fully anchored to repoPath', repoPath: REPO_PATH, diffCmd: a.diffCmd }
  }
}
const CONTEXT = (a.context ||
  'Review the diff below. Ground every finding in the actual code — read the cited source and whatever it depends on, not just the diff hunks. Report real defects, not style preferences.') +
  `\n\nREPO UNDER REVIEW: ${REPO_PATH} — run all git commands as \`git -C ${REPO_PATH} …\` and read only files under that path. The diff produced by \`${DIFF_CMD}\` IS the review scope; if it comes back empty, report that and STOP — do NOT substitute the current branch or the latest commit.`

// ---- Phase 1: SCOPE — establish the diff (+ optional sibling-branch combine check) ------
phase('Scope')
const combineCheck = BRANCH_GLOBS.length
  ? `1. COMBINED-REVIEW CHECK (do this FIRST). Run \`${GIT} branch --list ${BRANCH_GLOBS.map(g => `'${g}'`).join(' ')}\` ` +
    `and \`${GIT} branch --show-current\`. If there is MORE THAN ONE unmerged sibling branch off the same base ` +
    `(not just the current one), the correct move is to merge them into a single \`review/<topic>\` branch and ` +
    `review the combination ONCE (cheaper and strictly stronger — it sees the fixes interact). Report: the sibling ` +
    `branches found, and a clear recommendation — either "diff is already the right combined scope" OR "STOP: ` +
    `combine branches X, Y, Z into review/<topic> first, then re-run this review over that branch". Do NOT do ` +
    `the merge yourself; just report the recommendation.\n\n`
  : `1. No sibling-branch check was requested: return siblingBranches=[], recommendation="n/a", and base ` +
    `shouldProceed solely on the diff in step 2.\n\n`
const scope = await agent(
  `You are scoping an adversarial review of the repo at ${REPO_PATH}. Do TWO things and return them:\n\n` +
  combineCheck +
  `2. Produce the diff to review by running EXACTLY: \`${DIFF_CMD}\`. Return its size (files, +/- lines) ` +
  `and a terse map of what changed, and set diffEmpty accordingly. This diff — from that exact command — ` +
  `IS the review scope. If it is empty, set diffEmpty=true and STOP: do NOT substitute a different branch, ` +
  `the current branch, the latest commit, or \`git show HEAD\`. An empty diff means the caller pointed at the ` +
  `wrong range; that's their bug to fix, not yours to paper over.\n\n` +
  `Return all fields as structured output.`,
  { label: 'scope:branches+diff', phase: 'Scope', schema: {
    type: 'object', additionalProperties: false,
    required: ['siblingBranches', 'recommendation', 'diffSummary', 'diffEmpty', 'shouldProceed'],
    properties: {
      siblingBranches: { type: 'array', items: { type: 'string' } },
      recommendation: { type: 'string' },
      shouldProceed: { type: 'boolean', description: 'false if the reviewer should STOP and combine branches first' },
      diffEmpty: { type: 'boolean', description: 'true iff the exact DIFF_CMD produced no changes' },
      diffSummary: { type: 'string' },
    } } })

if (scope && scope.shouldProceed === false) {
  log(`SCOPE says STOP — combine sibling branches first: ${scope.recommendation}`)
  return { stoppedForCombine: true, scope }
}
// Deterministic gate: an empty diff is an abort, not a "review the current branch instead". That
// improvisation makes a run review the wrong thing — kill it at the script level.
if (scope && scope.diffEmpty === true) {
  log(`❌ DIFF_CMD produced an EMPTY diff (${DIFF_CMD}). Aborting — the review scope is empty; ` +
    `fix the diffCmd range. NOT substituting the current branch.`)
  return { aborted: true, reason: 'empty diff from diffCmd', diffCmd: DIFF_CMD, scope }
}
log(`Scope OK. Sibling branches: ${(scope?.siblingBranches || []).join(', ') || 'none'}. Reviewing.`)

// ---- Phase 2: FIND — one finder per dimension, over the diff ----------------------------
phase('Find')
const findings = await parallel(DIMENSIONS.map(dim => () =>
  agent(
    `${CONTEXT}\n\nProduce the diff with: \`${DIFF_CMD}\`. You are the "${dim}" finder — review ONLY through that lens. ` +
    `Report concrete defects with file:line, a minimal failing scenario (specific input -> wrong output/behavior), ` +
    `and severity. Empty array if nothing real. No style/naming nits unless the lens is 'simplification'.`,
    { label: `find:${dim}`, phase: 'Find', model: FIND_MODEL, schema: {
      type: 'object', additionalProperties: false, required: ['findings'],
      properties: { findings: { type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['summary', 'file', 'line', 'scenario', 'severity'],
        properties: {
          summary: { type: 'string' }, file: { type: 'string' }, line: { type: 'integer' },
          scenario: { type: 'string' }, severity: { enum: ['HIGH', 'MED', 'LOW'] },
        } } } } } })
    .then(r => (r?.findings ?? []).map(x => ({ ...x, finder: dim })))
))
const all = findings.filter(Boolean).flat()
log(`Find: ${all.length} raw findings across ${DIMENSIONS.length} dimensions`)

// ---- Phase 3: VERIFY — adversarially confirm/refute each (default REFUTED) --------------
phase('Verify')
const verified = await parallel(all.map(f => () =>
  agent(
    `${CONTEXT}\n\nAdversarially VERIFY this claimed defect. Your DEFAULT is REFUTED — confirm ONLY if you construct ` +
    `the concrete failing case and confirm the code actually does the wrong thing (read the real cited code + whatever ` +
    `it depends on; do not trust the claim). A "might regress" needs a concrete shape.\n\n` +
    `CLAIM (${f.finder}, ${f.severity}): ${f.summary}\nAt: ${f.file}:${f.line}\nScenario: ${f.scenario}\n\n` +
    `Verdict CONFIRMED only if real; else REFUTED with why. If CONFIRMED, give the exact minimal fix.`,
    { label: `verify:${f.finder}:${f.line}`, phase: 'Verify', model: VERIFY_MODEL, schema: {
      type: 'object', additionalProperties: false, required: ['verdict', 'reason'],
      properties: { verdict: { enum: ['CONFIRMED', 'REFUTED'] }, reason: { type: 'string' }, fix: { type: 'string' } } } })
    .then(v => ({ ...f, ...v }))
))
const confirmed = verified.filter(Boolean).filter(v => v.verdict === 'CONFIRMED')
log(`Verify: ${confirmed.length} CONFIRMED of ${all.length}`)
return {
  scope,
  confirmed,
  refuted: verified.filter(Boolean).filter(v => v.verdict === 'REFUTED').map(v => ({ s: v.summary, why: v.reason })),
}
