# Accounts

## What shipped

Full CRUD for financial accounts with live balance tracking.

- **Types**: bank, credit_card, cash, digital_wallet, crypto
- **Auto-slug code**: `Banco Galicia` → `banco-galicia`, re-slugs on rename
- **Currency**: user-defined per account, fuzzy search input showing existing currencies
- **Balance**: starting_balance + sum(income) - sum(expenses), computed live from records
- **Record count**: shown on each account card with "view records" link
- **Aliases**: comma-separated shorthand for smart parse (e.g. "galicia,gal" → Galicia ARS)
- **Default account**: explicit `isDefault` toggle, one per app. Parse fallback when no account detected.
- **Type filter**: toolbar with auto-collapse, filters account grid
- **Sort by usage**: `GET /api/accounts?sort=usage` returns accounts ordered by record count

## Design decisions

- **Code is auto-generated, not user-editable** — slug from name, re-slugged on rename. Prevents drift between name and code.
- **Currency is visual only** — no hardcoded rates, no conversion logic. Amounts and accounts are what matter.
- **Aliases are unique across all accounts** — validated on create/update with `DUPLICATE_ALIAS` error code. Prevents ambiguous parse matches.
- **Default account is explicit** — `isDefault` boolean rather than "most used". User controls which account gets auto-assigned when parse finds nothing.
- **Balance computed, not stored** — always derived from starting_balance + records. No sync issues.
- **Duplicate name error on field** — `DUPLICATE_NAME` code from API, shown inline on the name input (not a toast).

## How it works

### API

| Endpoint | Notes |
|---|---|
| `GET /api/accounts` | Sorted by name. `?sort=usage` for record count order. Returns balance + recordCount. |
| `POST /api/accounts` | Auto-generates code as slug. Unique name enforced. |
| `GET /api/accounts/currencies` | Distinct currency codes ordered by usage count. |
| `PUT /api/accounts/:id` | Re-slugs code on name change. Validates alias uniqueness. |
| `DELETE /api/accounts/:id` | Deletes account. (FK cascade behavior TBD) |

### Schema

| Column | Type | Notes |
|---|---|---|
| name | text | UNIQUE, display name |
| code | text | UNIQUE, auto-slug from name |
| type | text | bank, credit_card, cash, digital_wallet, crypto |
| currency | text | User-defined (ARS, USD, BTC, etc.) |
| aliases | text | Comma-separated parse shorthand, nullable |
| is_default | integer | Boolean, parse fallback account |
| starting_balance | real | Initial balance, default 0 |
