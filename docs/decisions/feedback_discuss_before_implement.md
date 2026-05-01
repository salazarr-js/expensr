---
name: Discuss before implementing — wait for explicit go-ahead
description: When user is exploring/discussing a feature change, do NOT start editing files. Wait for an explicit "do it" / "go ahead" / "implement" before touching code.
type: feedback
originSessionId: b47b9390-264b-4fb6-94fa-80b14573b7a0
---
When the user is in discussion/evaluation mode — asking how something works, asking "can the app do X?", asking "what's the easiest path?" — that is NOT permission to implement. They are thinking out loud. Stay in discussion: explain, ask clarifying questions, propose options.

**Why:** During the Real-Use Evaluation phase (started 2026-04-15) the user is deliberately slowing down to think. On 2026-04-15 I jumped from a discussion ("how can be that the most easy path for that") straight into editing the schema, and got interrupted. Wasted both of our time.

**How to apply:**
- Treat questions as questions, not as instructions.
- Implementation requires explicit verbs: "do it", "go ahead", "implement", "execute", "ship it", "make it so", "yes please do that".
- Even a clear-sounding "remove the starting balance" should be followed by "want me to do that now, or are we still planning?" if the surrounding messages are exploratory.
- Pattern to watch for: a user message that mixes a directive ("remove X") with open questions ("can the app do Y?", "how can it be easy?"). The open questions signal they're still designing — confirm before executing the directive.
- When unsure, ask: "Want me to execute this now or keep talking through the design?"
