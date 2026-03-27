# Changelog

## [Unreleased]

### Next steps
- Batch record creation with correct datetime ordering
- Dashboard with totals, category breakdown, period picker
- Review mode for `??` records
- "Who paid?" field for tracking expenses others paid on your behalf
- Quick Record payment support (keyword trigger for settlements)
- Custom TanStack Table for full styling control

## 2026-03-27 — DateRangePicker, Search & Category Filter

### DateRangePicker
- Reusable component: single button + popover with preset chips + UCalendar range mode
- Presets: Today, This week, This month, Last 3 months, This year, All time
- 2 months on desktop, 1 on mobile. Default: "This month"
- Replaces two separate date inputs in Records toolbar

### Records Search
- Text search across note, tag name, category name, and amounts
- Debounced 500ms, synced to URL `?search=`
- Amount search: typing a number matches exact amounts

### Category/Tag Filter
- Cascading UDropdownMenu: categories at top level, hover to expand tags
- Selecting a category filters all its records; selecting a tag filters that tag only
- API: `?categoryId` and `?tagId` params on GET /records (tag takes priority)

### Records Table Improvements
- Amount column sortable (client-side, ascending/descending toggle)
- Loading indicator on table during search/filter changes
- Empty state: "No records found" with "Clear filters" when filters are active vs "No records yet" when no records exist
- Toolbar: icon-only on mobile, consistent neutral/outline styling

## 2026-03-26 — Parse Observability, Auto-save & UI Polish

### Parse Logs & Feedback Loop
- `parse_logs` table replaces unused `parse_corrections` — logs every parse call
- Tracks resolution tier (`resolvedBy`: name_match, keyword, ai, none), AI usage, corrections
- `parseLogId` returned from parse, referenced by feedback endpoint
- Feedback wired end-to-end: QuickRecordModal → RecordFormModal → keyword dictionary
- `GET /records/parse/stats` — aggregate observability metrics
- `GET /records/parse/keywords` — exposes learned keyword→tag mappings

### Auto-save High-Confidence Matches
- Quick Record auto-saves when amount + account + tag resolved via name_match/keyword
- `??` records also auto-save (save now, review later)
- Toast with record summary + "Edit" action to reopen
- Falls back to form on failure or low confidence (AI/none)
- Input validation: requires standalone amount + 3+ letter word

### Spending Calculations
- `mySpend` field on all records — your actual portion after splits
- Solo = full amount, shared = amount minus others' shares, settlements = 0
- Account balance unchanged (cash flow); `mySpend` for future dashboard totals

### Form Improvements
- Note→tag auto-matching now checks keyword dictionary as fallback
- Manual split: "Me" input row added — all amounts must sum to record total
- Save disabled until manual amounts are balanced
- Account default fallback uses most-used account (by record count) instead of alphabetical
- Account name matching requires ≥40% of name length (prevents "ml" matching "MercadoLibre" by substring)

### Records Page UI
- Settlement rows: green background, green "Payment" badge, `+` prefix, `hand-coins` icon
- Needs-review rows (`??`): amber background
- Sticky header + sticky Amount column (pinned right)
- Amount prefix: `+` for income/settlements, `-` for expenses

### Icon Picker
- 30+ new icons: food/drink, sports, pets, personal, utility
- Bilingual search keywords (English + Spanish)
- `@iconify-json/lucide` installed — icons resolve at build time, zero runtime API calls

### Tag Cleanup
- All tags renamed to English (kept Spanish for Argentina-specific: Kiosko, Carniceria, Verduras, Expensas, Monotributo, Prepaga)
- All tags now have icons
- Deleted duplicates: Indumentaria (→ Clothing), Bar, Going Out
- Added: Groceries, Education

## 2026-03-25 — Custom Splits & Settlements

### Manual Split Amounts
- `split_type` column: equal, weighted, manual
- Per-person custom amounts via `personShares` in API
- Manual amounts don't recalculate when record amount changes

### Settlements (Debt Payments)
- `settlement` record type — exactly 1 person, no category/tag
- [Expense][Payment] toggle in form + "Payment" shortcut on People page
- Person selector: single-select, closes on pick, required

### Weighted Splits
- `my_shares` controls creator's share count
- Linked steppers: [I cover N] [Split /N]
- Quick record `/N` syntax: `102000 padel angy wilmer /5` → myShares=2

### Other
- Person name auto-capitalization (API + frontend)
- Inline person create from RecordFormModal
- Accounts sorted by usage in form dropdowns

## 2026-03-23 — People & Smart Parse

### People — Shared Expenses
- People CRUD with name + color (colored initial circles)
- Multi-person per record via junction table
- Debt tracking: balance = sum(share_amount) per person
- Person detection in smart parse ("uber angy 3500" → detects Angy)
- Records: people column (overlapping circles), person filter, multi-select in form

### Smart Parse
- Natural language → structured record: amount, date, account, tag, people
- Three-tier tag resolution: exact name → partial match → keyword dictionary → AI fallback
- Account aliases for shorthand ("galicia" → Galicia ARS, "ml" → MercadoLibre)
- Default account (explicit isDefault or most-used)
- Feedback learning: corrections build keyword dictionary for future parses
- QuickRecordModal for fast input

### Account Enhancements
- Aliases (comma-separated, unique, UInputTags in form)
- Default account toggle with star indicator
- Alias + name matching in parse resolution

## 2026-03-18 — Records

### Records
- Full CRUD with datetime ordering and reorder (datetime adjustment)
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
