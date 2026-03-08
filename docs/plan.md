# expensr — Implementation Plan

Feature-driven. Each feature builds its own types, API, and UI together.

Currency is user-defined on accounts (visual only). No hardcoded rates — amounts and accounts are what matter.

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

### Types (shared)
- [ ] Account interface (id, name, code, type, currency, color, icon, startingBalance)
- [ ] Account Zod schemas (create, update)

### API
- [ ] `GET /api/accounts` — list all
- [ ] `POST /api/accounts` — create (Zod validated)
- [ ] `GET /api/accounts/:id` — get one
- [ ] `PUT /api/accounts/:id` — update
- [ ] `DELETE /api/accounts/:id` — delete

### Web
- [ ] Accounts list page with currency badge, color, icon
- [ ] Create/edit account form (name, code, type, currency, color, icon, starting balance)
- [ ] Delete with confirmation
- [ ] API client for accounts

**Test:** Create account "Banco Galicia" (ARS). See it in list. Edit name. Delete it.

---

## 3. Categories & Tags

### Types (shared)
- [ ] Category interface (id, name, color, icon)
- [ ] Tag interface (id, name, categoryId, color, icon)
- [ ] Zod schemas for both

### API
- [ ] CRUD for categories (`/api/categories`)
- [ ] CRUD for tags (`/api/tags`) with category relation
- [ ] Default categories seeded on first use

### Web
- [ ] Categories page: list with color/icon, nested tags
- [ ] Create/edit category form
- [ ] Create/edit tag form (name, category picker, color, icon)
- [ ] API client for categories and tags

**Test:** Default categories load. Create tag "uber" under Transport. Tag shows nested under its category.

---

## 4. People

### Types (shared)
- [ ] Person interface (id, name, avatar?)
- [ ] Zod schemas

### API
- [ ] CRUD for people (`/api/people`)

### Web
- [ ] People page: list with name and avatar
- [ ] Create/edit person form
- [ ] API client for people

**Test:** Create person "Wilmer". Shows in list. Edit avatar. Delete.

---

## 5. Records

### Types (shared)
- [ ] FinancialRecord interface (id, type, amount, date, accountId, tagId?, categoryId?, personId?, linkedRecordId?, note?)
- [ ] Record type enum: expense, shared, transfer, exchange, fee
- [ ] Zod schemas (create, update)

### API
- [ ] `GET /api/records` — list with filters (account, date range, category, tag, person, type)
- [ ] `POST /api/records` — create (partial allowed: amount + date + account minimum)
- [ ] `GET /api/records/:id` — detail
- [ ] `PUT /api/records/:id` — update
- [ ] `DELETE /api/records/:id` — delete

### Web
- [ ] Records page: table view with filters
- [ ] Amount display respects account currency (visual formatting)
- [ ] Create/edit record form
- [ ] Record detail view
- [ ] API client for records

**Test:** Create expense on ARS account and USD account. Filter by account. Amounts display with correct currency format.

---

## 6. Quick Record

### API
- [ ] `POST /api/records/quick` — parse input string, create record
- [ ] Parser: extract amount, tag, person from text ("45 sushi", "30 beer wilmer")

### Web
- [ ] Global command bar (accessible from any page)
- [ ] Input parsing preview before confirm
- [ ] Account selector (default or last used)
- [ ] Keyboard shortcut to open

**Test:** Type "45 sushi" — creates expense with tag "sushi". Type "30 beer wilmer" — creates shared record linked to Wilmer.

---

## 7. Smart Categorization

- [ ] Tag-to-category learning: store association when tag is used with a category
- [ ] Auto-assign category when a known tag is used
- [ ] Category auto-fills in forms when typing a known tag
- [ ] Prompt to confirm/correct for new tags

**Test:** Record with tag "sushi" + category Food. Next "sushi" record auto-gets Food.

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

## 13. Polish & Deploy

- [ ] Responsive design (mobile-first)
- [ ] Loading states, error handling, empty states
- [ ] Keyboard shortcuts
- [ ] `pnpm build` + `pnpm deploy:cf`
- [ ] Production smoke test

**Test:** Full flow: create account, quick record, review, check dashboard.

---

## Future (out of scope for v1)

- D1 database migration
- Invoice photo upload + OCR
- Multi-user auth
- Recurring records
- Budget targets per category
- Export to CSV/PDF
