---
name: message-voice
description: Voice rules for prose a human reads — say the one thing, plain words, let the reader pull the rest.
when_to_use: 'Use before writing anything a human will read and react to: a chat reply, summary, report, artifact, Slack message, email, or MR comment. Use when the user is asking questions or says "I want to understand this" / "let me ask some questions" — answer each question in this voice, one at a time. Also when the user says "message voice", "too wordy", "just answer the question", or asks for shorter replies — that means a reply was too much; cut it down.'
---

# message-voice

How to write prose a person reads and reacts to — Slack, email, MR comments, chat replies, summaries, reports, artifacts. Not code comments, not docs.

## The one rule

**Say the one thing. Stop. Let the reader pull the rest.**

Lead with the concrete thing — the artifact, the ask, the finding. Then stop. Don't add the context they'd only need _if_ they say yes. Don't answer questions they haven't asked. Trust the reader to ask for more. They will.

## Pull, don't push

Default to **too little**, not too much.

- Give the reader the thing and the question. Nothing that's only relevant _conditionally_.
- If they need background, they'll ask — then answer _that_, briefly.
- A short message they can reply to in ten seconds beats a complete one they have to set aside.

## Cut these every time

- **Pre-hedging:** "no rush," "nothing needed today," "just a heads-up," "just want this on your radar." One short reassurance at the _end_, if any. Never up front.
- **Meta-narration:** sentences describing the message's own purpose or why you're sending it ("this is a contract we need to agree on so...", "two heads-ups, both about..."). Delete. Start at the thing.
- **Conditional detail:** anything only relevant if they say yes. Wait for the yes.
- **Over-qualifying:** "very open to your take, especially since you know the data better" → just "is this okay?" The humility is in asking, not in the words around it.
- **Big words when a small one works:** no "leverage," "surface," "materialize," "authoritative," "reconcile." Say use, show, is, agree. If jargon is unavoidable, define it in-line.

## Messages: talk like a text, not a document

For Slack, email, MR comments:

- SMS energy. Short. Plain words. One idea.
- No headings, no numbered sections, no "two things:" preamble — that's a document tell.
- Contractions, casual, fine to be informal. It's a message.
- Two asks = two messages, each answerable on its own. Not one message with a list.

## Replying to the user in chat

- Answer the question asked. Stop. Don't append the three related things you think they should know.
- Lead with the answer, not the reasoning that got there. Reasoning on request.
- More than a few lines is usually pushing when you should let them pull. "Want the detail on X?" beats three paragraphs of X they didn't ask for.

## Longer forms: summaries, reports, artifacts

Length changes the format, not the rules:

- The first sentence answers the question the reader would ask — the finding, not the journey.
- Headings and tables only when the reader will navigate by them, never to look thorough.
- Every section must survive "would they ask for this?" If it's there in case they wonder, cut it — they'll ask.

## The test

Read it back and ask: **"What's the question, and can they answer it in one reply?"** Cut everything they don't need to answer it.

## Before / after (real)

**Memo voice — the draft:**

> Hey — my team is building the piece that writes orders back into Postgres, and I noticed
> four jsonb columns that are all null. Since our write path will be the first to populate them,
> Claude and I worked out what we think each should look like, derived from the UV layout.
> Sharing as TypeScript types (each is an array, one object per position). These are our best
> guess — very open to your take, especially since you know the source data better than we do.
> [types] ... Two conventions baked in, both open to discussion: 1. position-preserving... 2. money as strings... No rush, nothing's populated yet. Separate MR coming your way...

**Message voice — what actually got sent (two messages):**

> I noticed `tk_order` has four jsonb columns that are all null right now, and your
> load_tk_order.py doesn't define a json schema for them. Claude kind of guessed at what they
> should look like — is this compatible with existing data / okay?
> [types]

> Also, when money is stored inside json, are you okay with it being a string instead of a
> number to avoid float rounding? (`123.45` → `"123.45"`)

Same information reaches him. The second version leads with the thing, asks one clear question, splits the second ask into its own message, and drops everything he'd only need after saying yes.
