# expensr — Implementation Plan

Feature-driven. Each feature builds its own types, migrations, API, and UI together.

Currency is user-defined on accounts (visual only). No hardcoded rates — amounts and accounts are what matter.

**Storage:** Cloudflare D1 (SQLite) with Drizzle ORM (`drizzle-orm/d1`). Schema-as-TypeScript in `packages/api/src/db/schema/`. Migrations generated via `drizzle-kit` into `packages/api/drizzle/`, applied via wrangler from `packages/web/`. Default categories + tags seeded via SQL migration (`0001_seed_categories.sql`).

---

## Real-Use Evaluation (started 2026-04-15)

Build phase paused. Using the app with real data to find out what's useful. No new features — bug fixes and removals welcome.

### Evaluation log

| Feature | Verdict | Date | Notes |
|---|---|---|---|
| Categories + Tags | ✅ Solid | 2026-04-21 | 12 categories, 45 tags (all English). Merged Corner Store → Groceries. Removed Monotributo from seed (personal). Added Family. |
| Accounts — starting balance | ❌ Removed | 2026-04-21 | Dropped column. Replaced by monthly balance model. |
| Account reconciliation | ❌ Replaced | 2026-04-21 | Dropped real_balance/real_balance_date. Replaced by `account_balances` table with monthly snapshots + gap detection. |
| Monthly balances (new) | 🛠 Built | 2026-04-21 | One balance per account per month (bank says X on date Y). Auto-computed initial/projected/gap. BalancesModal + BalanceFormModal + MonthPicker. Auto-reconciliation suggestion. |
| Spreadsheet mode | ❌ Removed | 2026-04-21 | Inline editing, batch/update, batch/delete APIs all removed. ~500 lines deleted. |
| Batch create (modal + API) | ❌ Removed | 2026-04-21 | BatchRecordModal deleted, POST /batch endpoint removed, store methods removed. Replaced by Claude Code `/expensr-batch` skill (planned). |
| QuickRecord batch mode | ❌ Removed | 2026-04-21 | Multi-line batch toggle removed from QuickRecordModal. ~240 lines deleted. |
| Draft records | ❌ Removed | 2026-05-01 | Was temporary. Removed — /quick restored to original parse+save. |
| Balances UI | ⚠️ Not convinced | 2026-05-01 | Monthly balances work but UI needs rethinking. Keep for now, revisit. |
| Records page | ⚠️ Needs rework | 2026-05-01 | Functional but not good enough. Revisit layout/UX. |
| Dashboard | ⚠️ Needs rework | 2026-05-01 | Revisit what's actually useful. |
| People — shared records link | ⚠️ Not convinced | 2026-05-01 | Link to shared records and payment button — not intuitive. |
| Accounts — record link | ⚠️ Improvable | 2026-05-01 | Works but could be better. Default star is good. |

---

## 0. Project Scaffolding

- [x] pnpm monorepo with workspaces + dependency catalog
- [x] `@slzr/expensr-shared` with tsconfig presets
- [x] `@slzr/expensr-api` — Hono app with `.basePath("/api")`
- [x] `@slzr/expensr-web` — Vue 3 + Vite + `@cloudflare/vite-plugin`
- [x] Bridge: `web/server/index.ts` imports Hono app
- [x] `pnpm dev` runs Vue HMR + API together
- [x] Root scripts: dev, build, preview, deploy:cf, typecheck
- [x] Editor config, node version, VS Code settings
- [x] Drizzle ORM + D1 database setup
- [x] DB schema: accounts, categories, tags, people, records (all tables + indexes + FKs)
- [x] D1 binding in `packages/web/wrangler.jsonc`, migrations dir points to `../api/drizzle`
- [x] `createDb(d1)` factory in `packages/api/src/db/index.ts`
- [x] Initial migration generated + seed migration for default categories
- [x] Scripts: `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:migrate:remote`
- [x] Removed standalone API dev (`dev:api`, api wrangler.jsonc); `typegen:cf` moved to web

---

## 1. App Layout & Web Foundation

- [x] Tailwind CSS 4 setup (via `@nuxt/ui/vite` plugin)
- [x] Nuxt UI 4 installed + registered as Vue plugin (light-only, `colorMode: false`)
- [x] Dashboard layout: UDashboardGroup + UDashboardSidebar + UDashboardPanel
- [x] Multi-layout system via Vue Router nested routes (DashboardLayout, BaseLayout)
- [x] Sidebar navigation (Dashboard, Records, Accounts, People, Settings)
- [x] Sidebar user menu with dropdown (Profile, Settings, Log out)
- [x] UDashboardSidebarCollapse on sidebar header + all page navbars
- [x] All placeholder pages with empty states (Records, Accounts, People, Settings)
- [x] Two 404 pages: DashboardNotFound (with sidebar) + NotFound (public)
- [x] Public Home page at `/`, dashboard routes under `/dashboard/`
- [x] Quick record button on dashboard navbar
- [x] Theme: fonts (Bricolage Grotesque, Manrope, JetBrains Mono) via Fontsource

**Test:** `pnpm dev` shows dashboard layout with sidebar nav. Click links, pages switch. `/` shows home. `/dashboard/xyz` shows 404 with sidebar.

---

## 2. Accounts

### D1 Migration
- [x] `accounts` table created (id, name, code, type, currency, color, icon, starting_balance, created_at, updated_at)

### Types (shared)
- [x] Account interface (id, name, code, type, currency, color, icon, startingBalance)
- [x] Account Zod schemas (create, update)

### API
- [x] `GET /api/accounts` — list all (sorted by name)
- [x] `POST /api/accounts` — create (Zod validated, unique name, auto-slug code)
- [x] `GET /api/accounts/currencies` — distinct currencies ordered by usage
- [x] `GET /api/accounts/:id` — get one
- [x] `PUT /api/accounts/:id` — update (re-slugs code on rename)
- [x] `DELETE /api/accounts/:id` — delete

### Web
- [x] Accounts list page with color-coded icons, type labels, currency + balance
- [x] Type filter toolbar (USelectMenu with "All" + individual types, auto-collapse)
- [x] Create/edit account modal (name, type, currency, color, icon, starting balance)
- [x] Delete with alert dialog confirmation
- [x] Duplicate name error shown on name input field
- [x] Error state with retry on fetch failure
- [x] Pinia store with fetch error handling + toasts
- [x] API client (useApi composable with ApiError class)
- [x] IconPicker with fuzzy search (Lucide + Simple Icons)
- [x] ColorPicker with 19 app colors

**Test:** Create account "Banco Galicia" (ARS). See it in list. Edit name. Delete it. Filter by type. Try duplicate name — field error.

---

## 3. Categories & Tags

### D1 Migration
- [x] `categories` table created (id, name, color, icon, created_at, updated_at)
- [x] `tags` table created (id, name, category_id FK, icon, created_at, updated_at) — color removed, tags inherit category color
- [x] 12 categories seeded (Transport, Housing, Health, Pets, Income, Shopping, Dining, Leisure, Personal, Finance, Digital, Travel)

### Types (shared)
- [x] Category, CategoryWithTagCount, CategoryWithTags interfaces
- [x] Tag, TagWithCategory interfaces
- [x] Zod schemas (createCategorySchema, updateCategorySchema, createTagSchema, updateTagSchema)

### API
- [x] CRUD for categories (`/api/categories`) with tag count, unique name, cascade delete
- [x] CRUD for tags as sub-routes (`/api/categories/:categoryId/tags`, `/api/categories/tags/:id`)
- [x] `isUniqueViolation` utility extracted to `packages/api/src/utils.ts`

### Web
- [x] Categories page: grid with color-coded icons, tag count, inline tag badges
- [x] Category form modal with inline tag management (add, edit, delete tags)
- [x] Tags editable inline — click tag to edit in shared input row
- [x] Duplicate name detection for both categories and tags
- [x] Error/loading/empty states matching accounts pattern
- [x] Keyboard accessible cards (tab, enter)
- [x] Delete category cascades with tag chips shown in confirmation dialog

**Test:** Categories load with tags. Click category to edit. Add/edit/delete tags inline. Delete category shows affected tags. Create new category with tags.

---

## 4. People — Shared Expenses ✅

**Detailed plan:** [04-people/](04-people/)

People you share expenses with. Multi-person per record (junction table `record_people`), equal split by default (amount / (people + you)), debt tracking per person. Only YOUR expenses are tracked — not other people's.

### D1 Migration
- [x] `people` table (id, name, color, created_at, updated_at)
- [x] `record_people` junction table (record_id, person_id, unique constraint, cascade delete)
- [x] Dropped `person_id` column from records (replaced by junction table)

### Types (shared)
- [x] Person interface (id, name, color, balance, recordCount)
- [x] Zod schemas (createPersonSchema, updatePersonSchema)
- [x] Records types: `personIds: number[]`, `people: {id, name}[]` on RecordWithRelations, `personIds/personNames` on ParsedRecord

### API
- [x] CRUD for people (`/api/people`) with computed debt balance + record count
- [x] Records: accept `personIds[]` on create/update, join people on list/detail, filter `?personId`
- [x] Parse: detect person names in input text

### Web
- [x] People page: grid with colored initial circles, debt balance (green/red), record count link
- [x] PersonFormModal: name + color picker
- [x] RecordFormModal: multi-person select with colored initials + None option
- [x] Records page: people column (overlapping colored circles), person filter dropdown
- [x] Records table: horizontal scroll with sticky Amount column, category/tag icons with colors
- [x] Mobile: people shown as small colored circles in record cards

### Weighted splits ✅
- [x] `record_people.share_amount` — pre-calculated debt per person
- [x] `records.my_shares` — creator's share count (1 = equal, >1 = weighted)
- [x] Debt calculation uses `sum(share_amount)` instead of runtime formula
- [x] RecordFormModal: +/- stepper for "I cover N shares" with split summary
- [x] Quick record `/N` syntax: `102000 padel angy wilmer raulo /5` → myShares=2

### Manual split amounts ✅
- [x] `records.split_type` column — 'equal' | 'weighted' | 'manual'
- [x] API: `personShares: [{personId, amount}]` for custom per-person amounts
- [x] Manual records don't recalculate when amount changes
- [x] UI: segmented [Equal][Manual] toggle, per-person inputs with remainder

### Settlements ✅
- [x] `'settlement'` record type — exactly 1 person, share_amount = full amount
- [x] API validation: `SETTLEMENT_ONE_PERSON` error code
- [x] No category/tag (debt payments, not spending)
- [x] UI: [Expense][Payment] toggle in form + "Payment" shortcut on People page
- [x] Person selector: single-select, closes on pick, required

### Next steps
- [x] **Parse logs + feedback wiring** — parse_logs table, resolvedBy tracking, feedback from QuickRecordModal → keyword dictionary. See [07-parse-logs/](07-parse-logs/)
- [x] **Spending calculations** — `mySpend` on RecordWithRelations (amount minus others' shares, 0 for settlements)
- [x] **Dashboard widgets** — debts summary with totals (owed to you / you owe), account performance, category breakdown

---

## 5. Records

### D1 Migration
- [x] `records` table created (id, type, amount, date, account_id FK, tag_id FK?, category_id FK?, linked_record_id FK?, note, needs_review, created_at, updated_at)
- [x] Indexes on account_id, date, category_id, tag_id
- [x] `person_id` removed — replaced by `record_people` junction table (step 4)

### Types (shared)
- [x] FinancialRecord + RecordWithRelations interfaces
- [x] Record type enum: expense, income (more types later: shared, transfer, exchange, fee)
- [x] Zod schemas (create, update, reorder)

### API
- [x] `GET /api/records` — list with filters (?accountId supports comma-separated, ?dateFrom, ?dateTo), joins account/category/tag names
- [x] `POST /api/records` — create (auto-appends current time to date)
- [x] `GET /api/records/:id` — detail with joined relations
- [x] `PUT /api/records/:id` — update (preserves time when only date changes)
- [x] `DELETE /api/records/:id` — delete
- [x] `POST /api/records/reorder` — reorder by adjusting datetime (afterId/beforeId)
- [x] `GET /api/accounts?sort=usage` — accounts sorted by record count

### D1 Migration (datetime)
- [x] `0003_records_date_to_datetime.sql` — convert date-only values to datetime (noon default)
- [x] New records auto-get current time on create

### Web
- [x] Records page: UTable with account multi-select + date range filters
- [x] Filters driven by URL query params (`/dashboard/records?account=18,19&dateFrom=...`) — shareable, bookmarkable
- [x] Amount display with currency, income highlighted green with + prefix
- [x] Create/edit record form modal (amount, date, account, category, tag, note)
- [x] Tag selector shows all tags; selecting a tag auto-picks its category
- [x] Category/tag/account dropdowns show color-coded icons
- [x] Accounts sorted by usage (most records first) in form
- [x] Type auto-assigned based on category (Income → income, else expense)
- [x] Reorder records with up/down arrows (cross-date support)
- [x] Delete with alert dialog confirmation
- [x] Loading/error/empty states
- [x] Pinia store with filter support
- [x] Record detail/edit via modal (no separate detail page needed)

### Account → Records integration
- [x] Account cards show live balance (starting balance + income - expenses)
- [x] Record count shown on each account card
- [x] "View records" link on each account card → navigates to `/dashboard/records?account={id}`
- [x] API always returns balance + recordCount on accounts list

**Test:** Create expense on ARS account and USD account. Filter by account. Amounts display with correct currency format. Click account card → opens records filtered by that account. Copy URL → paste → same filters applied.

---

## 6. Quick Record + Smart Parse ✅

Shipped. See [05-smart-parse/](05-smart-parse/) for full algorithm.

- [x] `POST /api/records/parse` — smart parse: tag name match (exact → partial) → keyword dictionary → Workers AI fallback
- [x] `POST /api/records/parse/feedback` — stores corrections, builds keyword→tag/account mappings
- [x] Account resolution: aliases (exact) → name (partial) → keyword map → default (isDefault or most records)
- [x] Account aliases + isDefault column on accounts
- [x] Amounts always absolute (type handles direction)
- [x] `??`/`???` needsReview markers, DD/MM/YY date parsing
- [x] QuickRecordModal — natural language input, opens form pre-filled with parse results
- [x] `keyword_mappings` + `parse_logs` tables (replaced `parse_corrections`)
- [x] Person detection in parse
- [x] Auto-save for high-confidence matches (name_match + keyword, toast with Edit action)

## 7. Smart Categorization ✅

Covered by Smart Parse. Tags already belong to categories — selecting a tag auto-assigns its category. No separate `tag_category_associations` table needed.

---

## 8. Transfers & Exchanges

### API
- [ ] `POST /api/records/transfer` — linked pair (out + in, same currency)
- [ ] `POST /api/records/exchange` — linked pair (different currencies) + optional fee
- [ ] Linked records reference each other via `linkedRecordId`

### Web
- [ ] Transfer form: from account, to account, amount
- [ ] Exchange form: from/to account, amount in each currency, optional fee
- [ ] Linked records shown together in detail
- [ ] Excluded from spending totals

**Test:** Transfer 100 from Bank to Cash — both accounts reflect it. Exchange USD to ARS — fee tracked separately.

---

## 9. Dashboard ✅

No dedicated API endpoint — frontend fetches records for current + previous period and computes everything client-side.

### Web
- [x] Spending summary cards grouped by currency (expense totals + income)
- [x] Previous period comparison (% change, fetches prior period records)
- [x] Currency selector (toggle between currencies when multiple exist)
- [x] Daily spending bar chart (teal/rose coloring, avg line, responsive labels, tap tooltips on mobile)
- [x] Category breakdown: interactive SVG donut + bar list with %, period change, click → records
- [x] Uncategorized filter (`?categoryId=none`, excludes settlements)
- [x] Account balances overview with spending performance vs previous period
- [x] Debts summary (people with non-zero balance, totals, links to filtered records)
- [x] Recent records widget (last 5 in period)
- [x] DateRangePicker in navbar (presets: Today, Week, Month, 3M, Year, All)
- [x] All filters synced to URL query params for back-navigation preservation

**Test:** Change date range. Click category → records filtered. Press back → dashboard restores. Check multi-currency toggle. Tap bars on mobile.

---

## ~~10. Records — Spreadsheet Mode~~ ❌ Removed (2026-04-21)

Removed during evaluation. Inline editing, batch/update, batch/delete APIs, BatchRecordModal, QuickRecord batch mode — all deleted. ~500 lines of code removed across 6 files. Batch record creation will be handled via Claude Code `/expensr-batch` skill instead of in-app UI. See [12-expensr-batch-skill/](12-expensr-batch-skill/).

---

## 11. Records — Advanced Views

- [ ] Account column view (records grouped by account, side-by-side)
- [ ] Sortable table columns
- [ ] View toggle (table / columns)

**Test:** Switch views. Filters work in both.

---

## 11. Review Mode ✅

- [x] `GET /api/records/review/count` — count of needsReview records
- [x] `GET /api/records?needsReview=true` — filter to review records
- [x] Review badge (warning) in Records navbar with count, toggles filter
- [x] Amber row background for needsReview records
- [x] NeedsReview checkbox in create/edit form, auto-toggled by `??` in note
- [x] Tag assignment auto-clears needsReview
- [x] Keyword learning on review resolution (tag assigned + review cleared)

**Test:** Create record with `??`. Shows amber. Click review badge → filters. Edit, assign tag → needsReview clears, keyword learned.

---

## 12. Bank Import

- [ ] `POST /api/import` — accepts CSV, XLS, XLSX
- [ ] Parser: extract date, amount, description
- [ ] Auto-match to tags/categories/people
- [ ] Import preview UI: review before confirming
- [ ] Bulk confirm/edit/skip

**Test:** Upload CSV with 5 rows. Preview shows parsed records. Confirm. Records appear in list.

---

## 13. Settings

### Storage
- [ ] `settings` table (key-value, single row per user) or JSON blob in D1
- [ ] Default settings applied when no user settings exist

### API
- [ ] `GET /api/settings` — get current settings
- [ ] `PUT /api/settings` — update settings

### Web
- [ ] Settings page with grouped sections
- [ ] **Display**: Number format (comma separator `,` vs `.`), date format
- [ ] **Appearance**: Light / dark theme toggle
- [ ] **Defaults**: Default account, default currency
- [ ] Settings persisted to D1, loaded on app start
- [ ] Pinia settings store consumed by formatters and theme

**Test:** Change number separator to `.`, amounts update across the app. Toggle dark theme, UI switches. Refresh — settings persist.

---

## 14. PWA ✅

- [x] Web manifest (`public/manifest.webmanifest`) — name, icons, standalone display, teal theme
- [x] Service worker (`public/sw.js`) — cache-first for static assets, network-first for navigation, API calls excluded
- [x] App icons: 192x192, 512x512 (+ maskable), apple-touch-icon 180x180
- [x] Meta tags: theme-color, apple-mobile-web-app-capable, description
- [x] Service worker registration in `main.ts`

**Test:** Open on mobile → browser shows "Install app" prompt. Install → opens standalone. Works offline for cached pages.

---

## 15. Polish & Deploy

- [ ] Responsive design (mobile-first)
- [ ] Loading states, error handling, empty states
- [ ] `pnpm build` + `pnpm deploy:cf`
- [ ] Production smoke test

**Test:** Full flow: create account, quick record, review, check dashboard.

---

## Future (out of scope for v1)

- ~~Account ordering by usage~~ ✅ Done
- ~~Records drag-and-drop reorder~~ ✅ Done (SortableJS, desktop handle + mobile long-press)
- Quick record for all features: extend smart parse to handle transfers, settlements, and exchanges via natural language. Patterns: `transfer 3500 galicia → cash`, `3500 de galicia a cash`, `pago angy 5000`, `exchange 100 usd → ars 95000`. Parser detects keywords (transfer/pago/exchange/de...a...) and routes to the correct API endpoint. The `/quick` endpoint should also support these patterns for iPhone Shortcuts. All record types reachable without opening a form.
- Credit cards: account type `credit_card` with closing date, due date, credit limit. Installment purchases (`cuotas`): total amount, number of installments, track remaining installments per record. Monthly statement estimate: sum upcoming installment charges for next billing cycle. Credit card records keep category/tag so they appear in spending charts alongside debit purchases. Payment of statement = Transfer from bank account to credit card (depends on Transfers feature). Dashboard widget: next statement estimate, remaining installments breakdown.
- Multi-currency debt: People page should show debt per currency (join records → accounts), not a single number. Dashboard debts widget same.
- Loans: dedicated `loan` record type — no category, pure debt, dashboard widget for total lent out. Currently workaround: expense with manual split where person owes 100%.
- Who paid?: "Who paid?" field on records for tracking expenses others paid on your behalf.
- Live refresh: WebSocket via Durable Object — broadcast "refresh" to connected clients when records change from another device (Shortcut, etc.). Free tier covers single-user.
- Store caching: reference data (accounts, categories, tags, people, keywords) fetched on every modal open (5 requests). Cache with staleness check in stores instead.
- Note auto-complete: suggest previous notes as the user types (query distinct notes, fuzzy match)
- Category ordering by usage (sort by record count)
- FK cascade behavior: tag/category deletion → SET NULL on records. Account deletion blocked if has records.
- Invoice photo upload + OCR
- Multi-user auth
- Recurring records
- Budget targets per category
- Export to CSV/PDF
- Custom TanStack Table: replace UTable for full styling control
- Auto-generated CHANGELOG.md — see [00-foundation/changelog-plan.md](00-foundation/changelog-plan.md)
