# DB Sync CLI — Push/Pull data between local and production D1

## Context

After local development (new categories, tags, accounts), those need to be pushed to production. Production is the source of truth for real usage — local can always be restored with `pnpm db:pull all`.

**Dependency:** `better-sqlite3` must be in the root `devDependencies` (via catalog) since `scripts/db-sync.ts` runs from the root workspace.

## Usage

```bash
pnpm db:push categories          # push categories + their tags to prod
pnpm db:push accounts            # push accounts to prod
pnpm db:push all                 # push everything

pnpm db:pull records             # pull records from prod to local
pnpm db:pull all                 # pull everything from prod
```

## How it works

1. **Push** — reads local D1 via `better-sqlite3`, generates SQL, executes against remote via `wrangler d1 execute --remote`
2. **Pull** — exports remote via `wrangler d1 export --remote --no-schema`, filters for target tables, applies to local via `better-sqlite3`
3. **Verify** — after sync, compares row counts between local and remote for the synced tables

Both directions do a **full table replace** (delete all rows then insert). Simple and correct for a single-user app.

## Backups

No custom backups needed — Cloudflare D1 Time Travel covers remote (7-day history on free plan). If local breaks, just `pnpm db:pull all`.

## FK-aware table groups

When you push/pull a table, its dependencies come along automatically:

| Argument | Tables included (in order) |
|---|---|
| `categories` | categories, tags |
| `accounts` | accounts |
| `people` | people |
| `records` | accounts, categories, tags, people, records |
| `all` | categories, accounts, people, tags, records |

Delete order is always reverse of insert order to respect FKs.
