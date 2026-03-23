import { Hono } from "hono";
import { eq, count, desc, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { createAccountSchema, updateAccountSchema, slugify } from "@slzr/expensr-shared";
import { createDb } from "../db";
import { accounts } from "../db/schema";
import { records } from "../db/schema";
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
    // Check against other account names
    if (others.some((a) => a.name.toLowerCase() === alias)) return alias;
    // Check against other account aliases
    for (const other of others) {
      const otherAliases = other.aliases?.split(",") ?? [];
      if (otherAliases.includes(alias)) return alias;
    }
  }
  return null;
}

const route = new Hono<{ Bindings: CloudflareBindings }>();

/** Account fields with computed balance (startingBalance + income - expenses). */
function accountsWithBalance(db: ReturnType<typeof createDb>) {
  return db
    .select({
      id: accounts.id,
      name: accounts.name,
      code: accounts.code,
      type: accounts.type,
      currency: accounts.currency,
      color: accounts.color,
      icon: accounts.icon,
      aliases: accounts.aliases,
      isDefault: accounts.isDefault,
      startingBalance: accounts.startingBalance,
      createdAt: accounts.createdAt,
      updatedAt: accounts.updatedAt,
      balance: sql<number>`${accounts.startingBalance} + coalesce(sum(case when ${records.type} = 'income' then ${records.amount} else -${records.amount} end), 0)`.as("balance"),
      recordCount: count(records.id).as("recordCount"),
    })
    .from(accounts)
    .leftJoin(records, eq(accounts.id, records.accountId))
    .groupBy(accounts.id);
}

/** List all accounts with computed balance. ?sort=usage orders by record count. */
route.get("/", async (ctx) => {
  const db = createDb(ctx.env.DB);
  const sort = ctx.req.query("sort");

  const order = sort === "usage"
    ? [desc(count(records.id)), accounts.name]
    : [accounts.name];

  const rows = await accountsWithBalance(db).orderBy(...order);
  return ctx.json(rows);
});

/** Distinct currencies across all accounts, ordered by usage count (most used first). */
route.get("/currencies", async (ctx) => {
  const db = createDb(ctx.env.DB);

  const rows = await db
    .select({ currency: accounts.currency, count: count() })
    .from(accounts)
    .groupBy(accounts.currency)
    .orderBy(desc(count()), accounts.currency);

  return ctx.json(rows.map((r) => r.currency));
});

/** POST / — create account. Auto-slugs code, validates aliases uniqueness, handles default toggle. */
route.post("/", async (ctx) => {
  const body = await ctx.req.json();
  const parsed = createAccountSchema.safeParse(body);

  if (!parsed.success) {
    return ctx.json({ error: z.treeifyError(parsed.error) }, 400);
  }

  const db = createDb(ctx.env.DB);
  const code = slugify(parsed.data.name);
  const aliases = normalizeAliases(parsed.data.aliases);

  // Validate alias uniqueness
  if (aliases) {
    const conflict = await findAliasConflict(db, aliases.split(","));
    if (conflict) {
      return ctx.json({ code: "DUPLICATE_ALIAS", error: `Alias "${conflict}" is already in use` }, 409);
    }
  }

  // Unset previous default if this account is being set as default
  if (parsed.data.isDefault) {
    await db.update(accounts).set({ isDefault: false }).where(eq(accounts.isDefault, true));
  }

  try {
    const [row] = await db.insert(accounts).values({ ...parsed.data, code, aliases }).returning();
    return ctx.json(row, 201);
  } catch (e: unknown) {
    if (isUniqueViolation(e)) {
      return ctx.json({ code: "DUPLICATE_NAME", error: "An account with this name already exists" }, 409);
    }
    throw e;
  }
});

/** Get a single account by ID. */
route.get("/:id", async (ctx) => {
  const id = parseId(ctx.req.param("id"));
  if (isNaN(id)) return ctx.json({ error: "Invalid ID" }, 400);
  const db = createDb(ctx.env.DB);

  const row = await db.select().from(accounts).where(eq(accounts.id, id)).get();

  if (!row) return ctx.json({ error: "Account not found" }, 404);

  return ctx.json(row);
});

/** PUT /:id — partial update. Re-slugs code on rename, validates aliases, handles default toggle. */
route.put("/:id", async (ctx) => {
  const id = Number(ctx.req.param("id"));
  const body = await ctx.req.json();
  const parsed = updateAccountSchema.safeParse(body);

  if (!parsed.success) {
    return ctx.json({ error: z.treeifyError(parsed.error) }, 400);
  }

  const db = createDb(ctx.env.DB);

  const updates: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.name) {
    updates.code = slugify(parsed.data.name);
  }

  // Normalize and validate aliases
  if (parsed.data.aliases !== undefined) {
    const aliases = normalizeAliases(parsed.data.aliases);
    updates.aliases = aliases;
    if (aliases) {
      const conflict = await findAliasConflict(db, aliases.split(","), id);
      if (conflict) {
        return ctx.json({ code: "DUPLICATE_ALIAS", error: `Alias "${conflict}" is already in use` }, 409);
      }
    }
  }

  // Unset previous default if this account is being set as default
  if (parsed.data.isDefault) {
    await db.update(accounts).set({ isDefault: false }).where(eq(accounts.isDefault, true));
  }

  try {
    const [row] = await db
      .update(accounts)
      .set(updates)
      .where(eq(accounts.id, id))
      .returning();

    if (!row) return ctx.json({ error: "Account not found" }, 404);

    return ctx.json(row);
  } catch (e: unknown) {
    if (isUniqueViolation(e)) {
      return ctx.json({ code: "DUPLICATE_NAME", error: "An account with this name already exists" }, 409);
    }
    throw e;
  }
});

/** Delete an account by ID. */
route.delete("/:id", async (ctx) => {
  const id = parseId(ctx.req.param("id"));
  if (isNaN(id)) return ctx.json({ error: "Invalid ID" }, 400);
  const db = createDb(ctx.env.DB);

  const [row] = await db
    .delete(accounts)
    .where(eq(accounts.id, id))
    .returning();

  if (!row) return ctx.json({ error: "Account not found" }, 404);

  return ctx.json({ ok: true });
});

export default route;
