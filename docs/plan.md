# expensr — Implementation Plan

Feature-driven. Each feature builds its own types, migrations, API, and UI together.

Currency is user-defined on accounts (visual only). No hardcoded rates — amounts and accounts are what matter.

**Storage:** Cloudflare D1 (SQLite) with Drizzle ORM (`drizzle-orm/d1`). Schema-as-TypeScript in `packages/api/src/db/schema/`. Migrations generated via `drizzle-kit` into `packages/api/drizzle/`, applied via wrangler from `packages/web/`. Default categories seeded via hand-written SQL migration (`INSERT OR IGNORE`).

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

**Detailed plan:** [docs/people-plan.md](people-plan.md)

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

### Next steps (not yet implemented)
- [ ] **Settlements** — "Angy paid me 37200" record type to reduce debt balance. Partial settlements supported.
- [ ] **Spending calculations** — shared records count as `amount / (people + 1)` in totals/charts instead of full amount. Your real spend, not cash flow.
- [ ] **Dashboard widgets** — total debt others owe you, settlement history, how much others spent on you vs you on them

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

Shipped. See [docs/smart-parse.md](smart-parse.md) for full algorithm.

- [x] `POST /api/records/parse` — smart parse: tag name match (exact → partial) → keyword dictionary → Workers AI fallback
- [x] `POST /api/records/parse/feedback` — stores corrections, builds keyword→tag/account mappings
- [x] Account resolution: aliases (exact) → name (partial) → keyword map → default (isDefault or most records)
- [x] Account aliases + isDefault column on accounts
- [x] Amounts always absolute (type handles direction)
- [x] `??`/`???` needsReview markers, DD/MM/YY date parsing
- [x] QuickRecordModal — natural language input, opens form pre-filled with parse results
- [x] `keyword_mappings` + `parse_corrections` tables
- [ ] Person detection in parse (pending People feature)
- [ ] Keyboard shortcut to open QuickRecordModal
- [ ] Auto-save for high-confidence matches (after training phase)

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

## 9. Dashboard

### API
- [ ] `GET /api/dashboard?period=month&date=YYYY-MM` — totals per account, category breakdown, recent records

### Web
- [ ] Account balances overview
- [ ] Spending totals grouped by currency
- [ ] Category breakdown
- [ ] Recent records widget
- [ ] Debts summary (people with outstanding shared records)
- [ ] Period picker (month/quarter/year) + comparison toggle

**Test:** Add records across categories and people. Dashboard totals match. Switch period, numbers update.

---

## 10. Records — Advanced Views

- [ ] Account column view (records grouped by account, side-by-side)
- [ ] Sortable table columns
- [ ] View toggle (table / columns)

**Test:** Switch views. Filters work in both.

---

## 11. Review Mode

- [ ] `GET /api/records/review` — records missing tag or category
- [ ] Review queue UI: step through one by one
- [ ] Quick actions: assign tag, category, skip
- [ ] Badge count in nav

**Test:** Create partial record (amount only). Shows in review. Assign tag + category, leaves queue.

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

## 14. Polish & Deploy

- [ ] Responsive design (mobile-first)
- [ ] Loading states, error handling, empty states
- [ ] Keyboard shortcuts
- [ ] `pnpm build` + `pnpm deploy:cf`
- [ ] Production smoke test

**Test:** Full flow: create account, quick record, review, check dashboard.

---

## Future (out of scope for v1)

- ~~Account ordering by usage (sort by record count, most used accounts first) — depends on records feature~~ ✅ Done (GET /api/accounts?sort=usage)
- Note auto-complete: suggest previous notes as the user types in the record form (query distinct notes from records table, fuzzy match)
- Records drag-and-drop reorder: replace up/down arrow buttons with drag-and-drop (e.g., vue-draggable or @dnd-kit). Reorder API already exists (`POST /api/records/reorder`), just needs a better UI
- Category ordering by usage (sort by record count, most used categories first) — depends on records feature
- FK cascade behavior: tag/category deletion should SET NULL on records (record stays, loses tag/category). Account deletion should be blocked if it has records. Needs schema migration with ON DELETE actions.
- Invoice photo upload + OCR
- Multi-user auth
- Recurring records
- Budget targets per category
- Export to CSV/PDF
- Auto-generated CHANGELOG.md from commits/features — see [docs/changelog-plan.md](changelog-plan.md)
