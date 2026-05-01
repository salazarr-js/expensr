---
name: Always pause for review before commit
description: Never chain commit+push+deploy without stopping for user review and /simplify first
type: feedback
---

Even when the user says "commit push and deploy" in one message, ALWAYS pause after showing the diff summary and wait for the user to review and run `/simplify` first. Never chain commit+push+deploy without a review step in between.

**Why:** User runs `/simplify` manually before every commit to review code quality. Skipping this step deployed unreviewed code to production.

**How to apply:** When asked to commit/push/deploy, show the diff summary and stop. Wait for the user to confirm after their review.
