import { Hono } from "hono";
import { eq, asc, desc, ne, inArray, count } from "drizzle-orm";
import { z } from "zod";
import {
  createAccountSchema,
  updateAccountSchema,
  createBalanceSchema,
  updateBalanceSchema,
  slugify,
} from "@slzr/expensr-shared";
import { createDb } from "../db";
import { accounts, accountBalances, records } from "../db/schema";
import { isUniqueViolation, parseId } from "../utils";

/** Parse and normalize aliases string: split, trim, lowercase, dedupe, filter short. */
function normalizeAliases(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const list = [...new Set(raw.split(",").map((a) => a.trim().toLowerCase()).filter((a) => a.length >= 2))];
  return list.length ? list.join(",") : null;
}

/** Check if any alias in `newAliases` conflicts with other accounts' aliases or names. */
async function findAliasConflict(
  db: ReturnType<typeof createDb>,
  newAliases: string[],
  excludeId?: number,
): Promise<string | null> {
  const others = excludeId
    ? await db.select({ id: accounts.id, name: accounts.name, aliases: accounts.aliases }).from(accounts).where(ne(accounts.id, excludeId))
    : await db.select({ id: accounts.id, name: accounts.name, aliases: accounts.aliases }).from(accounts);

  for (const alias of newAliases) {
    if (others.some((a) => a.name.toLowerCase() === alias)) return alias;
    for (const other of others) {
      const otherAliases = other.aliases?.split(",") ?? [];
      if (otherAliases.includes(alias)) return alias;
    }
  }
  return null;
}

/** Signed cash-flow contribution of a record to its account balance. */
function recordSignedAmount(r: { id: number; type: string; amount: number; linkedRecordId: number | null }): number {
  if (r.type === "income") return r.amount;
  if (r.type === "transfer") {
    return r.linkedRecordId !== null && r.linkedRecordId < r.id ? r.amount : -r.amount;
  }
  return -r.amount;
}

const route = new Hono<{ Bindings: CloudflareBindings }>();

/** Loads all accounts with balance computed from the monthly balance model. */
async function loadAccountsWithBalance(db: ReturnType<typeof createDb>, sortByUsage: boolean) {
  const baseAccounts = await db.select().from(accounts);
  if (!baseAccounts.length) return [];

  const accountIds = baseAccounts.map((a) => a.id);

  // All monthly balances — newest month first per account
  const balances = await db
    .select()
    .from(accountBalances)
    .where(inArray(accountBalances.accountId, accountIds))
    .orderBy(accountBalances.accountId, desc(accountBalances.yearMonth));

  // All records (just the fields needed for balance math)
  const rawRecords = await db
    .select({
      id: records.id,
      accountId: records.accountId,
      type: records.type,
      amount: records.amount,
      date: records.date,
      linkedRecordId: records.linkedRecordId,
    })
    .from(records)
    .where(inArray(records.accountId, accountIds));

  // Group by account
  const balByAccount = new Map<number, typeof balances>();
  for (const b of balances) {
    const arr = balByAccount.get(b.accountId) ?? [];
    arr.push(b);
    balByAccount.set(b.accountId, arr);
  }

  const recsByAccount = new Map<number, typeof rawRecords>();
  for (const r of rawRecords) {
    const arr = recsByAccount.get(r.accountId) ?? [];
    arr.push(r);
    recsByAccount.set(r.accountId, arr);
  }

  const result = baseAccounts.map((a) => {
    const bals = balByAccount.get(a.id) ?? []; // newest month first
    const recs = recsByAccount.get(a.id) ?? [];
    const latest = bals[0] ?? null;

    if (!latest) {
      // No monthly balance set — pure cash flow from all records
      const total = recs.reduce((s, r) => s + recordSignedAmount(r), 0);
      return {
        ...a, balance: total, recordCount: recs.length,
        monthlyBalance: null, initialBalance: 0, projectedEnd: total, gap: null,
      };
    }

    // Records before vs after the balance date (within the balance's month)
    const monthStart = `${latest.yearMonth}-01`;
    const monthEnd = latest.yearMonth < "9999-99" ? nextMonthStart(latest.yearMonth) : "9999-99";

    const recsBefore = recs.filter((r) => {
      const d = r.date.slice(0, 10);
      return d >= monthStart && d <= latest.balanceDate;
    });
    const recsAfter = recs.filter((r) => {
      const d = r.date.slice(0, 10);
      return d > latest.balanceDate && d < monthEnd;
    });
    // Records outside the balance's month (future months with no balance set)
    const recsAfterMonth = recs.filter((r) => r.date.slice(0, 10) >= monthEnd);

    const sumBefore = recsBefore.reduce((s, r) => s + recordSignedAmount(r), 0);
    const sumAfter = recsAfter.reduce((s, r) => s + recordSignedAmount(r), 0);
    const sumAfterMonth = recsAfterMonth.reduce((s, r) => s + recordSignedAmount(r), 0);

    const initialBalance = latest.balance - sumBefore;
    const projectedEnd = latest.balance + sumAfter;
    const balance = projectedEnd + sumAfterMonth; // current live balance

    // Gap: projected end vs next month's balance. For the latest (newest) month, there's no next → null.
    const nextMonthBal = bals.find((b) => b.yearMonth > latest.yearMonth);
    const gap = nextMonthBal ? projectedEnd - nextMonthBal.balance : null;

    return {
      ...a, balance, recordCount: recs.length,
      monthlyBalance: { yearMonth: latest.yearMonth, balance: latest.balance, balanceDate: latest.balanceDate },
      initialBalance,
      projectedEnd,
      gap,
    };
  });

  if (sortByUsage) {
    result.sort((x, y) => y.recordCount - x.recordCount || x.name.localeCompare(y.name));
  } else {
    result.sort((x, y) => x.name.localeCompare(y.name));
  }

  return result;
}

/** Returns "YYYY-MM-01" for the month after the given "YYYY-MM". */
function nextMonthStart(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const next = m! === 12 ? `${y! + 1}-01` : `${y}-${String(m! + 1).padStart(2, "0")}`;
  return `${next}-01`;
}

/** List all accounts with computed balance. ?sort=usage orders by record count. */
route.get("/", async (ctx) => {
  const db = createDb(ctx.env.DB);
  const sort = ctx.req.query("sort");
  const rows = await loadAccountsWithBalance(db, sort === "usage");
  return ctx.json(rows);
});

/** Distinct currencies across all accounts, ordered by usage count. */
route.get("/currencies", async (ctx) => {
  const db = createDb(ctx.env.DB);
  const rows = await db
    .select({ currency: accounts.currency, count: count() })
    .from(accounts)
    .groupBy(accounts.currency)
    .orderBy(desc(count()), accounts.currency);
  return ctx.json(rows.map((r) => r.currency));
});

/** POST / — create account. */
route.post("/", async (ctx) => {
  const body = await ctx.req.json();
  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) return ctx.json({ error: z.treeifyError(parsed.error) }, 400);

  const db = createDb(ctx.env.DB);
  const code = slugify(parsed.data.name);
  const aliases = normalizeAliases(parsed.data.aliases);

  if (aliases) {
    const conflict = await findAliasConflict(db, aliases.split(","));
    if (conflict) return ctx.json({ code: "DUPLICATE_ALIAS", error: `Alias "${conflict}" is already in use` }, 409);
  }

  if (parsed.data.isDefault) {
    await db.update(accounts).set({ isDefault: false }).where(eq(accounts.isDefault, true));
  }

  try {
    const [row] = await db.insert(accounts).values({ ...parsed.data, code, aliases }).returning();
    return ctx.json(row, 201);
  } catch (e: unknown) {
    if (isUniqueViolation(e)) return ctx.json({ code: "DUPLICATE_NAME", error: "An account with this name already exists" }, 409);
    throw e;
  }
});

// ── Monthly Balances ────────────────────────────────────────────────

/** GET /:id/balances — list all monthly balances for an account (newest first) with computed fields. */
route.get("/:id/balances", async (ctx) => {
  const accountId = parseId(ctx.req.param("id"));
  if (isNaN(accountId)) return ctx.json({ error: "Invalid ID" }, 400);
  const db = createDb(ctx.env.DB);

  const bals = await db
    .select()
    .from(accountBalances)
    .where(eq(accountBalances.accountId, accountId))
    .orderBy(asc(accountBalances.yearMonth));

  const recs = await db
    .select({
      id: records.id,
      type: records.type,
      amount: records.amount,
      date: records.date,
      linkedRecordId: records.linkedRecordId,
    })
    .from(records)
    .where(eq(records.accountId, accountId));

  const withComputed = bals.map((bal, i) => {
    const monthStart = `${bal.yearMonth}-01`;
    const monthEnd = nextMonthStart(bal.yearMonth);

    const before = recs.filter((r) => {
      const d = r.date.slice(0, 10);
      return d >= monthStart && d <= bal.balanceDate;
    });
    const after = recs.filter((r) => {
      const d = r.date.slice(0, 10);
      return d > bal.balanceDate && d < monthEnd;
    });

    const initialBalance = bal.balance - before.reduce((s, r) => s + recordSignedAmount(r), 0);
    const projectedEnd = bal.balance + after.reduce((s, r) => s + recordSignedAmount(r), 0);

    const nextBal = bals[i + 1] ?? null;
    const gap = nextBal ? projectedEnd - nextBal.balance : null;

    return {
      ...bal,
      initialBalance,
      projectedEnd,
      gap,
      recordsBefore: before.length,
      recordsAfter: after.length,
    };
  });

  // Return newest first for UI
  return ctx.json(withComputed.reverse());
});

/** POST /:id/balances — create or update a monthly balance (upsert by yearMonth). */
route.post("/:id/balances", async (ctx) => {
  const accountId = parseId(ctx.req.param("id"));
  if (isNaN(accountId)) return ctx.json({ error: "Invalid ID" }, 400);
  const body = await ctx.req.json();
  const parsed = createBalanceSchema.safeParse(body);
  if (!parsed.success) return ctx.json({ error: z.treeifyError(parsed.error) }, 400);

  const db = createDb(ctx.env.DB);

  // Upsert: if month already exists for this account, update it
  const existing = await db
    .select()
    .from(accountBalances)
    .where(eq(accountBalances.accountId, accountId))
    .all()
    .then((rows) => rows.find((r) => r.yearMonth === parsed.data.yearMonth));

  if (existing) {
    const [row] = await db
      .update(accountBalances)
      .set({ balance: parsed.data.balance, balanceDate: parsed.data.balanceDate, updatedAt: new Date() })
      .where(eq(accountBalances.id, existing.id))
      .returning();
    return ctx.json(row);
  }

  const [row] = await db
    .insert(accountBalances)
    .values({ accountId, ...parsed.data })
    .returning();
  return ctx.json(row, 201);
});

/** DELETE /:id/balances/:balId — remove a monthly balance. */
route.delete("/:id/balances/:balId", async (ctx) => {
  const balId = parseId(ctx.req.param("balId"));
  if (isNaN(balId)) return ctx.json({ error: "Invalid ID" }, 400);
  const db = createDb(ctx.env.DB);
  const [row] = await db.delete(accountBalances).where(eq(accountBalances.id, balId)).returning();
  if (!row) return ctx.json({ error: "Balance not found" }, 404);
  return ctx.json({ ok: true });
});

/** GET /:id/balances/suggest?yearMonth=2026-04 — suggests a balance that closes the gap with the next month. */
route.get("/:id/balances/suggest", async (ctx) => {
  const accountId = parseId(ctx.req.param("id"));
  if (isNaN(accountId)) return ctx.json({ error: "Invalid ID" }, 400);
  const yearMonth = ctx.req.query("yearMonth");
  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) return ctx.json({ error: "yearMonth query param required (YYYY-MM)" }, 400);

  const db = createDb(ctx.env.DB);

  // Find the next month's balance
  const nextBal = await db
    .select()
    .from(accountBalances)
    .where(eq(accountBalances.accountId, accountId))
    .orderBy(asc(accountBalances.yearMonth))
    .all()
    .then((rows) => rows.find((r) => r.yearMonth > yearMonth));

  if (!nextBal) return ctx.json({ suggestedBalance: null });

  // Sum records in the requested month
  const monthStart = `${yearMonth}-01`;
  const monthEnd = nextMonthStart(yearMonth);

  const recs = await db
    .select({
      id: records.id,
      type: records.type,
      amount: records.amount,
      date: records.date,
      linkedRecordId: records.linkedRecordId,
    })
    .from(records)
    .where(eq(records.accountId, accountId));

  const inMonth = recs.filter((r) => {
    const d = r.date.slice(0, 10);
    return d >= monthStart && d < monthEnd;
  });
  const monthDelta = inMonth.reduce((s, r) => s + recordSignedAmount(r), 0);

  // suggested = nextBal.balance - monthDelta → makes gap exactly 0
  const suggestedBalance = Math.round((nextBal.balance - monthDelta) * 100) / 100;
  return ctx.json({ suggestedBalance });
});

// ── Account by ID ───────────────────────────────────────────────────

/** Get a single account by ID. */
route.get("/:id", async (ctx) => {
  const id = parseId(ctx.req.param("id"));
  if (isNaN(id)) return ctx.json({ error: "Invalid ID" }, 400);
  const db = createDb(ctx.env.DB);
  const row = await db.select().from(accounts).where(eq(accounts.id, id)).get();
  if (!row) return ctx.json({ error: "Account not found" }, 404);
  return ctx.json(row);
});

/** PUT /:id — partial update. */
route.put("/:id", async (ctx) => {
  const id = Number(ctx.req.param("id"));
  const body = await ctx.req.json();
  const parsed = updateAccountSchema.safeParse(body);
  if (!parsed.success) return ctx.json({ error: z.treeifyError(parsed.error) }, 400);

  const db = createDb(ctx.env.DB);
  const updates: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.name) updates.code = slugify(parsed.data.name);

  if (parsed.data.aliases !== undefined) {
    const aliases = normalizeAliases(parsed.data.aliases);
    updates.aliases = aliases;
    if (aliases) {
      const conflict = await findAliasConflict(db, aliases.split(","), id);
      if (conflict) return ctx.json({ code: "DUPLICATE_ALIAS", error: `Alias "${conflict}" is already in use` }, 409);
    }
  }

  if (parsed.data.isDefault) {
    await db.update(accounts).set({ isDefault: false }).where(eq(accounts.isDefault, true));
  }

  try {
    const [row] = await db.update(accounts).set(updates).where(eq(accounts.id, id)).returning();
    if (!row) return ctx.json({ error: "Account not found" }, 404);
    return ctx.json(row);
  } catch (e: unknown) {
    if (isUniqueViolation(e)) return ctx.json({ code: "DUPLICATE_NAME", error: "An account with this name already exists" }, 409);
    throw e;
  }
});

/** Delete an account by ID. */
route.delete("/:id", async (ctx) => {
  const id = parseId(ctx.req.param("id"));
  if (isNaN(id)) return ctx.json({ error: "Invalid ID" }, 400);
  const db = createDb(ctx.env.DB);
  const [row] = await db.delete(accounts).where(eq(accounts.id, id)).returning();
  if (!row) return ctx.json({ error: "Account not found" }, 404);
  return ctx.json({ ok: true });
});

export default route;
