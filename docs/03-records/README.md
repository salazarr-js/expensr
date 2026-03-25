# Records

## What shipped

Full CRUD for financial records with datetime ordering, filtering, and reorder support.

- **Types**: expense, income (more planned: transfer, exchange, fee)
- **Datetime ordering**: stored as ISO "YYYY-MM-DDTHH:MM:SS" text, sorted DESC. New records auto-get current time.
- **Filters**: account (multi-select, comma-separated IDs), date range, person. Synced to URL query params.
- **Reorder**: up/down arrows adjust datetime to midpoint between neighbors (works cross-date)
- **Category/tag auto-assign**: selecting a tag auto-picks its parent category. Income category → type=income.
- **Amount**: always positive — type field handles direction (expense vs income)
- **People**: multi-person per record via `record_people` junction table. See [04-people](../04-people/) and [06-custom-splits](../06-custom-splits/).
- **Mobile**: card list layout, desktop gets table with horizontal scroll and sticky Amount column

## Design decisions

- **Datetime, not date** — records need intra-day ordering. Time auto-appended on create, preserved on date-only updates.
- **Amount always positive** — simplifies math, display, and parse. `type` field handles direction.
- **Filters in URL** — `/dashboard/records?account=18,19&dateFrom=2026-03-01` is shareable and bookmarkable.
- **Category from tag** — tags belong to categories, so selecting a tag determines the category. User can override category independently.
- **No separate detail page** — record detail/edit via modal. No navigation needed.
- **Reorder via datetime** — no explicit sort_order column. Reorder sets datetime to midpoint between two neighbors. Simple and works with date-based sorting.

## How it works

### API

| Endpoint | Notes |
|---|---|
| `GET /api/records` | Filters: `?accountId=1,2`, `?dateFrom`, `?dateTo`, `?personId`. Joins account/category/tag/people. |
| `POST /api/records` | Auto-appends current time. Type based on category. Accepts `personIds[]` and `myShares`. |
| `PUT /api/records/:id` | Preserves time when only date changes. Recalculates share_amounts when relevant. |
| `DELETE /api/records/:id` | Cascade cleans record_people. |
| `POST /api/records/reorder` | `{id, afterId?, beforeId?}` — adjusts datetime to midpoint. |

### Schema

| Column | Type | Notes |
|---|---|---|
| type | text | expense, income |
| amount | real | Always positive |
| date | text | ISO datetime "YYYY-MM-DDTHH:MM:SS" |
| account_id | integer | FK, required |
| tag_id | integer | FK, optional |
| category_id | integer | FK, optional |
| linked_record_id | integer | For future transfers/exchanges |
| my_shares | integer | Default 1, for weighted splits |
| note | text | Free-text, nullable |
| needs_review | integer | Boolean, flagged via ?? in parse |
