# Database

Cloudflare D1 (SQLite) via Drizzle ORM. Schema defined in `packages/api/src/db/schema/` (one file per table).

## Tables

### accounts

Where money lives. Bank accounts, credit cards, cash, digital wallets, crypto.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | integer | PK, auto-increment | |
| name | text | NOT NULL, UNIQUE | Display name |
| code | text | NOT NULL, UNIQUE | URL-friendly slug, auto-generated from name |
| type | text | NOT NULL | bank, credit_card, cash, digital_wallet, crypto |
| currency | text | NOT NULL | User-defined (e.g. ARS, USD, BTC) |
| color | text | nullable | App color name (e.g. "Slate", "Blue") |
| icon | text | nullable | Iconify icon name (e.g. "i-lucide-landmark") |
| starting_balance | real | NOT NULL, default 0 | Initial balance when account was created |
| created_at | integer | NOT NULL, default unixepoch() | Unix timestamp |
| updated_at | integer | NOT NULL, default unixepoch() | Unix timestamp |

### categories

High-level spending groups. 12 seeded categories.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | integer | PK, auto-increment | |
| name | text | NOT NULL, UNIQUE | Display name (English) |
| color | text | nullable | App color name |
| icon | text | nullable | Iconify icon name |
| created_at | integer | NOT NULL, default unixepoch() | |
| updated_at | integer | NOT NULL, default unixepoch() | |

### tags

Specific context for records. Belong to a category. Tags inherit category color.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | integer | PK, auto-increment | |
| name | text | NOT NULL, UNIQUE | Display name (any language) |
| category_id | integer | FK → categories.id | Parent category |
| icon | text | nullable | Iconify icon name, fallback: `#` |
| created_at | integer | NOT NULL, default unixepoch() | |
| updated_at | integer | NOT NULL, default unixepoch() | |

### people

Individuals involved in shared expenses or money owed/lent.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | integer | PK, auto-increment | |
| name | text | NOT NULL | |
| avatar | text | nullable | URL or identifier |
| created_at | integer | NOT NULL, default unixepoch() | |
| updated_at | integer | NOT NULL, default unixepoch() | |

### records

Any financial movement: expense, shared, transfer, exchange, or fee.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | integer | PK, auto-increment | |
| type | text | NOT NULL | expense, shared, transfer, exchange, fee |
| amount | real | NOT NULL | Positive = income, negative = expense |
| date | text | NOT NULL | ISO date string |
| account_id | integer | NOT NULL, FK → accounts.id | Every record must have an account |
| tag_id | integer | FK → tags.id | Optional |
| category_id | integer | FK → categories.id | Optional |
| person_id | integer | FK → people.id | Optional, used for shared expenses |
| linked_record_id | integer | | Self-reference for transfer/exchange pairs |
| note | text | nullable | Free-text note |
| created_at | integer | NOT NULL, default unixepoch() | |
| updated_at | integer | NOT NULL, default unixepoch() | |

**Indexes:** account_id, date, category_id, tag_id, person_id

## Relationships

```
accounts ──1:N── records (account_id, NOT NULL)
categories ──1:N── tags (category_id)
categories ──1:N── records (category_id, optional)
tags ──1:N── records (tag_id, optional)
people ──1:N── records (person_id, optional)
records ──1:1── records (linked_record_id, self-reference for transfer/exchange pairs)
```

## FK behavior (pending)

Currently no ON DELETE actions defined. Planned changes (see plan.md Future section):
- tag/category deletion → SET NULL on records (record stays, loses tag/category)
- account deletion → RESTRICT (blocked if account has records)

## Seeded data

12 categories seeded via `packages/api/drizzle/0001_seed_categories.sql`:
Transport, Housing, Health, Pets, Income, Shopping, Dining, Leisure, Personal, Finance, Digital, Travel.

## Migrations

Schema-as-TypeScript in `packages/api/src/db/schema/`. Drizzle Kit generates SQL migrations.

```bash
pnpm db:generate        # Diff schema → new SQL migration in packages/api/drizzle/
pnpm db:migrate         # Apply migrations to local D1
pnpm db:migrate:remote  # Apply migrations to production D1
pnpm db:studio          # Browse local DB visually
```

Workflow: edit schema → `pnpm db:generate` → `pnpm db:migrate` → dev & test → commit → `pnpm db:migrate:remote` → deploy.

## D1 CLI commands

Run SQL directly against the database via wrangler. Must be executed from `packages/web/` (where `wrangler.jsonc` lives).

```bash
# Local database
npx wrangler d1 execute expensr-db --local --command "SQL HERE"

# Remote (production) database
npx wrangler d1 execute expensr-db --remote --command "SQL HERE"
```

### Common queries

```bash
# List all tables
npx wrangler d1 execute expensr-db --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"

# Count rows
npx wrangler d1 execute expensr-db --local --command "SELECT COUNT(*) as count FROM categories;"

# Categories with tag names
npx wrangler d1 execute expensr-db --local --command "SELECT c.name as category, GROUP_CONCAT(t.name, ', ') as tags FROM categories c LEFT JOIN tags t ON t.category_id = c.id GROUP BY c.id ORDER BY c.name;"

# All tags with category
npx wrangler d1 execute expensr-db --local --command "SELECT t.name, t.icon, c.name as category FROM tags t LEFT JOIN categories c ON t.category_id = c.id ORDER BY c.name, t.name;"

# All accounts
npx wrangler d1 execute expensr-db --local --command "SELECT * FROM accounts ORDER BY name;"
```

### Insert / Update / Delete

```bash
# Insert category
npx wrangler d1 execute expensr-db --local --command "INSERT OR IGNORE INTO categories (name, icon) VALUES ('Food', 'i-lucide-utensils');"

# Insert tag (need category_id)
npx wrangler d1 execute expensr-db --local --command "INSERT OR IGNORE INTO tags (name, category_id, icon) VALUES ('Netflix', 23, 'i-lucide-tv');"

# Update
npx wrangler d1 execute expensr-db --local --command "UPDATE categories SET icon = 'i-lucide-home' WHERE name = 'Housing';"

# Delete (respect FK order: children first)
npx wrangler d1 execute expensr-db --local --command "DELETE FROM tags WHERE category_id = 1; DELETE FROM categories WHERE id = 1;"
```

### Notes

- `--local` hits the local dev database, `--remote` hits production
- `INSERT OR IGNORE` skips if unique constraint would be violated
- Delete order matters: children (tags) before parents (categories) due to FK constraints
- Multiple statements can be separated with `;` in one command
