import { Hono } from "hono";
import { eq, count, desc, sum, sql } from "drizzle-orm";
import { z } from "zod";
import { createAccountSchema, updateAccountSchema, slugify } from "@slzr/expensr-shared";
import { createDb } from "../db";
import { accounts } from "../db/schema";
import { records } from "../db/schema";
import { isUniqueViolation, parseId } from "../utils";

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

/** Create a new account. Code is auto-generated as a slug from the name. */
route.post("/", async (ctx) => {
  const body = await ctx.req.json();
  const parsed = createAccountSchema.safeParse(body);

  if (!parsed.success) {
    return ctx.json({ error: z.treeifyError(parsed.error) }, 400);
  }

  const db = createDb(ctx.env.DB);
  const code = slugify(parsed.data.name);

  try {
    const [row] = await db.insert(accounts).values({ ...parsed.data, code }).returning();
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

/** Partially update an account by ID. */
route.put("/:id", async (ctx) => {
  const id = Number(ctx.req.param("id"));
  const body = await ctx.req.json();
  const parsed = updateAccountSchema.safeParse(body);

  if (!parsed.success) {
    return ctx.json({ error: z.treeifyError(parsed.error) }, 400);
  }

  const db = createDb(ctx.env.DB);

  // Re-slug the code if the name changed
  const updates: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.name) {
    updates.code = slugify(parsed.data.name);
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
