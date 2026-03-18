import { Hono } from "hono";
import { eq, and, gte, lte, desc, asc, gt, lt, inArray } from "drizzle-orm";
import { z } from "zod";
import { createRecordSchema, updateRecordSchema, reorderRecordSchema } from "@slzr/expensr-shared";
import { createDb } from "../db";
import { records } from "../db/schema";
import { accounts } from "../db/schema";
import { categories } from "../db/schema";
import { tags } from "../db/schema";
import { parseId } from "../utils";

const route = new Hono<{ Bindings: CloudflareBindings }>();

/** If a date string has no time component, append current time. */
function ensureDatetime(date: string): string {
  if (date.includes("T")) return date;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${date}T${hh}:${mm}:${ss}`;
}

/** Normalize a date-only filter value to include time bounds for datetime comparison. */
function filterDateFrom(d: string): string {
  return d.includes("T") ? d : `${d}T00:00:00`;
}
function filterDateTo(d: string): string {
  return d.includes("T") ? d : `${d}T23:59:59`;
}

/** Parse "YYYY-MM-DDTHH:MM:SS" to Unix seconds (treating as UTC to avoid timezone issues). */
function toUnix(dt: string): number {
  return Date.parse(dt.endsWith("Z") ? dt : dt + "Z") / 1000;
}

/** Convert Unix seconds back to "YYYY-MM-DDTHH:MM:SS" (UTC, no Z suffix to match our format). */
function fromUnix(secs: number): string {
  return new Date(secs * 1000).toISOString().slice(0, 19);
}

/** Builds a SELECT with joined relation names for display. */
function recordsWithRelations(db: ReturnType<typeof createDb>) {
  return db
    .select({
      id: records.id,
      type: records.type,
      amount: records.amount,
      date: records.date,
      accountId: records.accountId,
      tagId: records.tagId,
      categoryId: records.categoryId,
      personId: records.personId,
      linkedRecordId: records.linkedRecordId,
      note: records.note,
      createdAt: records.createdAt,
      updatedAt: records.updatedAt,
      accountName: accounts.name,
      accountCurrency: accounts.currency,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
      tagName: tags.name,
    })
    .from(records)
    .innerJoin(accounts, eq(records.accountId, accounts.id))
    .leftJoin(categories, eq(records.categoryId, categories.id))
    .leftJoin(tags, eq(records.tagId, tags.id));
}

/** List records with optional filters. Joins account, category, and tag names. */
route.get("/", async (ctx) => {
  const db = createDb(ctx.env.DB);
  const { accountId, dateFrom, dateTo } = ctx.req.query();

  const conditions = [];
  if (accountId) {
    const ids = accountId.split(",").map(Number).filter((n) => !isNaN(n));
    if (ids.length === 1) conditions.push(eq(records.accountId, ids[0]));
    else if (ids.length > 1) conditions.push(inArray(records.accountId, ids));
  }
  if (dateFrom) conditions.push(gte(records.date, filterDateFrom(dateFrom)));
  if (dateTo) conditions.push(lte(records.date, filterDateTo(dateTo)));

  const query = recordsWithRelations(db);
  const rows = conditions.length
    ? await query.where(and(...conditions)).orderBy(desc(records.date), desc(records.id))
    : await query.orderBy(desc(records.date), desc(records.id));

  return ctx.json(rows);
});

/** Create a new record. Auto-appends current time if only a date is provided. */
route.post("/", async (ctx) => {
  const body = await ctx.req.json();
  const parsed = createRecordSchema.safeParse(body);

  if (!parsed.success) {
    return ctx.json({ error: z.treeifyError(parsed.error) }, 400);
  }

  const db = createDb(ctx.env.DB);
  const data = { ...parsed.data, date: ensureDatetime(parsed.data.date) };

  const [row] = await db.insert(records).values(data).returning();
  return ctx.json(row, 201);
});

/** Get a single record by ID with joined relations. */
route.get("/:id", async (ctx) => {
  const id = parseId(ctx.req.param("id"));
  if (isNaN(id)) return ctx.json({ error: "Invalid ID" }, 400);
  const db = createDb(ctx.env.DB);

  const row = await recordsWithRelations(db).where(eq(records.id, id)).get();

  if (!row) return ctx.json({ error: "Record not found" }, 404);
  return ctx.json(row);
});

/** Partially update a record by ID. Preserves time if only date portion changes. */
route.put("/:id", async (ctx) => {
  const id = parseId(ctx.req.param("id"));
  if (isNaN(id)) return ctx.json({ error: "Invalid ID" }, 400);
  const body = await ctx.req.json();
  const parsed = updateRecordSchema.safeParse(body);

  if (!parsed.success) {
    return ctx.json({ error: z.treeifyError(parsed.error) }, 400);
  }

  const db = createDb(ctx.env.DB);

  const updates = { ...parsed.data, updatedAt: new Date() };

  // If only a date is sent (no time), preserve the existing time portion
  if (updates.date && !updates.date.includes("T")) {
    const existing = await db.select({ date: records.date }).from(records).where(eq(records.id, id)).get();
    if (existing?.date.includes("T")) {
      const timePart = existing.date.split("T")[1];
      updates.date = `${updates.date}T${timePart}`;
    } else {
      updates.date = ensureDatetime(updates.date);
    }
  }

  const [row] = await db
    .update(records)
    .set(updates)
    .where(eq(records.id, id))
    .returning();

  if (!row) return ctx.json({ error: "Record not found" }, 404);
  return ctx.json(row);
});

/** Reorder a record by placing it before or after another record.
 *  Adjusts the datetime to position it correctly in sort order. */
route.post("/reorder", async (ctx) => {
  const body = await ctx.req.json();
  const parsed = reorderRecordSchema.safeParse(body);

  if (!parsed.success) {
    return ctx.json({ error: z.treeifyError(parsed.error) }, 400);
  }

  const { id, afterId, beforeId } = parsed.data;
  const db = createDb(ctx.env.DB);

  let newDatetime: string;

  if (afterId) {
    // Place the record right AFTER afterId in the list (list is sorted DESC, so "after" = lower datetime)
    const target = await db.select().from(records).where(eq(records.id, afterId)).get();
    if (!target) return ctx.json({ error: "Target record not found" }, 404);

    // Find the next record below the target in desc order (the one with the next-lower datetime)
    const below = await db
      .select()
      .from(records)
      .where(lt(records.date, target.date))
      .orderBy(desc(records.date))
      .limit(1)
      .get();

    const t1 = toUnix(target.date);
    if (below && below.id !== id) {
      // Midpoint between target and the record below it
      const t2 = toUnix(below.date);
      newDatetime = fromUnix(Math.floor((t1 + t2) / 2));
    } else {
      // Nothing below — place 1 second earlier
      newDatetime = fromUnix(t1 - 1);
    }
  } else if (beforeId) {
    // Place the record right BEFORE beforeId in the list (list is sorted DESC, so "before" = higher datetime)
    const target = await db.select().from(records).where(eq(records.id, beforeId)).get();
    if (!target) return ctx.json({ error: "Target record not found" }, 404);

    // Find the record above the target in desc order (the one with the next-higher datetime)
    const above = await db
      .select()
      .from(records)
      .where(gt(records.date, target.date))
      .orderBy(asc(records.date))
      .limit(1)
      .get();

    const t1 = toUnix(target.date);
    if (above && above.id !== id) {
      // Midpoint between the record above and the target
      const t2 = toUnix(above.date);
      newDatetime = fromUnix(Math.floor((t1 + t2) / 2));
    } else {
      // Nothing above — place 1 second later
      newDatetime = fromUnix(t1 + 1);
    }
  } else {
    return ctx.json({ error: "Provide afterId or beforeId" }, 400);
  }

  const [row] = await db
    .update(records)
    .set({ date: newDatetime, updatedAt: new Date() })
    .where(eq(records.id, id))
    .returning();

  return ctx.json(row);
});

/** Delete a record by ID. */
route.delete("/:id", async (ctx) => {
  const id = parseId(ctx.req.param("id"));
  if (isNaN(id)) return ctx.json({ error: "Invalid ID" }, 400);
  const db = createDb(ctx.env.DB);

  const [row] = await db
    .delete(records)
    .where(eq(records.id, id))
    .returning();

  if (!row) return ctx.json({ error: "Record not found" }, 404);
  return ctx.json({ ok: true });
});

export default route;
