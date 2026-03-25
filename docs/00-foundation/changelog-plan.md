# Auto-generate CHANGELOG.md

## Context

The project has clean commit messages that describe features well. Generate a CHANGELOG.md grouped by feature milestones, not individual commits. No tooling needed — just a one-time script or manual generation from git log, kept up to date on each deploy.

## Approach

Create `CHANGELOG.md` at project root. Group by version/date, list features with bullet points. Based on the actual commits, not automated conventional-commits tooling (the commit style is descriptive but not conventional-commits format).

## Content

```markdown
# Changelog

## [Unreleased]

### Next steps
- Settlements (debt payments between people)
- Spending calculations (shared records show your share, not full amount)
- Dashboard with totals, category breakdown, period picker

## 2026-03-23 — People & Smart Parse

### People — Shared Expenses
- People CRUD with name + color (colored initial circles)
- Multi-person per record via junction table
- Debt tracking: balance = amount / (people + you) per shared record
- Person detection in smart parse ("uber angy 3500" → detects Angy)
- Records: people column (overlapping circles), person filter, multi-select in form
- Responsive table with sticky Amount column

### Smart Parse
- Natural language → structured record: amount, date, account, tag, people
- Three-tier tag resolution: exact name → partial match → keyword dictionary → AI fallback
- Account aliases for shorthand ("galicia" → Galicia ARS, "usd" → Galicia USD)
- Default account (explicit isDefault or most-used)
- Feedback learning: corrections build keyword dictionary for future parses
- Absolute amounts (sign ignored, type field handles direction)
- QuickRecordModal for fast input

### Account Enhancements
- Aliases (comma-separated, unique, UInputTags in form)
- Default account toggle with colored star indicator
- Alias + name matching in parse resolution

## 2026-03-18 — Records

### Records
- Full CRUD with datetime ordering and reorder (drag via datetime adjustment)
- Filters: account (multi), date range, synced to URL query params
- Mobile card list + desktop table with category/tag icons
- Account balance integration (starting balance + income - expenses)
- Record count + "view records" link on account cards

## 2026-03-17 — Categories & Tags

### Categories & Tags
- 12 seeded categories (Transport, Housing, Health, etc.)
- Tags belong to categories, inherit color
- Inline tag management in category modal
- Cascade delete (category → tags)

## 2026-03-16 — Accounts

### Accounts
- CRUD with type (bank, credit card, cash, digital wallet, crypto)
- Color + icon picker, currency with fuzzy search
- Type filter toolbar
- Auto-slug code from name

## 2026-03-13 — Foundation

### Project Setup
- pnpm monorepo (api, web, shared packages)
- Vue 3 + Nuxt UI 4 + Tailwind CSS 4
- Hono API on Cloudflare Workers
- Drizzle ORM + D1 database
- Multi-layout routing (Dashboard, Base)
- Light/dark/system theme
```

## Files

| Action | File |
|--------|------|
| Create | `CHANGELOG.md` at project root |
| Modify | `CLAUDE.md` — reference changelog |

## Verification

Read through and confirm dates/features match git log.
