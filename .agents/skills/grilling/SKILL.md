---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the whole frontier in one round, then wait for the user's answers before the next round.

## Presenting a round

If the `AskUserQuestion` tool is available, use it to present the round instead of writing questions as plain text:

- One `AskUserQuestion` call per round, with every frontier question in that call (up to 8 questions per call, 2-4 options each).
- Each question's `header` is the question title; the question text is the body (can be multiple paragraphs).
- Each option is a candidate answer with a short label and a one-line description of what it implies / its trade-off. Order your recommended answer first and mark it as such in its description (e.g. "(recommended)").
- Let the built-in "Other" choice cover free-text answers you didn't anticipate — don't add your own "other" option.
- If a question doesn't reduce to a handful of discrete options (open-ended, needs a number, needs prose), ask it as plain text in the same reply instead of forcing it into `AskUserQuestion`.

If `AskUserQuestion` is not available (e.g. plain chat without tool access), fall back to this format:

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>

---

❓ **Q2** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

Either way, number each question and always give your recommended answer — the mechanism changes, the content doesn't.

## Working the tree

Each round the user answers reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one.

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, tools, etc.), dispatch a sub-agent to find it; don't ask the user for anything you could look up yourself. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report; ask the rest of the frontier now. The _decisions_ are the user's: put each to them and wait.

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on it until the user confirms you have reached a shared understanding.
