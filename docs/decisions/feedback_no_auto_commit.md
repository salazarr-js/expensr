---
name: No auto commit/push/deploy
description: Never commit, push, or deploy without explicit user request — user wants to review code and run /simplify first
type: feedback
---

Never commit, push, or deploy without the user explicitly asking. Always stop after implementation and let the user review.

**Why:** User was surprised when code was committed, pushed, and deployed without being asked. They want to review changes and run `/simplify` manually before any commit.

**How to apply:** After finishing implementation, stop and summarize what changed. Wait for the user to say "commit", "push", "deploy", etc. Never chain commit → push → deploy automatically even if the user asked to "commit and push" in a previous conversation.
