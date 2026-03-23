import { Hono } from "hono";
import { eq, count, sql } from "drizzle-orm";
import { z } from "zod";
import { createPersonSchema, updatePersonSchema } from "@slzr/expensr-shared";
import { createDb } from "../db";
import { people } from "../db/schema";
import { records } from "../db/schema";
import { recordPeople } from "../db/schema";
import { parseId } from "../utils";

const route = new Hono<{ Bindings: CloudflareBindings }>();

/** People with computed debt balance and shared record count. */
function peopleWithBalance(db: ReturnType<typeof createDb>) {
  // Debt = sum of (amount / (people_count + 1)) for each shared record
  // Positive = they owe you (expense), negative = you owe them (income)
  return db
    .select({
      id: people.id,
      name: people.name,
      color: people.color,
      createdAt: people.createdAt,
      updatedAt: people.updatedAt,
      balance: sql<number>`coalesce(sum(
        case when ${records.type} = 'expense'
          then ${records.amount} / (
            (select count(*) from record_people where record_id = ${records.id}) + 1
          )
          else -${records.amount} / (
            (select count(*) from record_people where record_id = ${records.id}) + 1
          )
        end
      ), 0)`.as("balance"),
      recordCount: count(records.id).as("recordCount"),
    })
    .from(people)
    .leftJoin(recordPeople, eq(people.id, recordPeople.personId))
    .leftJoin(records, eq(recordPeople.recordId, records.id))
    .groupBy(people.id);
}

/** GET / — list all people with debt balance. */
route.get("/", async (ctx) => {
  const db = createDb(ctx.env.DB);
  const rows = await peopleWithBalance(db).orderBy(people.name);
  return ctx.json(rows);
});

/** POST / — create person. */
route.post("/", async (ctx) => {
  const body = await ctx.req.json();
  const parsed = createPersonSchema.safeParse(body);

  if (!parsed.success) {
    return ctx.json({ error: z.treeifyError(parsed.error) }, 400);
  }

  const db = createDb(ctx.env.DB);
  const [row] = await db.insert(people).values(parsed.data).returning();
  return ctx.json(row, 201);
});

/** GET /:id — get person with debt summary. */
route.get("/:id", async (ctx) => {
  const id = parseId(ctx.req.param("id"));
  if (isNaN(id)) return ctx.json({ error: "Invalid ID" }, 400);
  const db = createDb(ctx.env.DB);

  const row = await peopleWithBalance(db).where(eq(people.id, id)).get();
  if (!row) return ctx.json({ error: "Person not found" }, 404);
  return ctx.json(row);
});

/** PUT /:id — update person. */
route.put("/:id", async (ctx) => {
  const id = parseId(ctx.req.param("id"));
  if (isNaN(id)) return ctx.json({ error: "Invalid ID" }, 400);
  const body = await ctx.req.json();
  const parsed = updatePersonSchema.safeParse(body);

  if (!parsed.success) {
    return ctx.json({ error: z.treeifyError(parsed.error) }, 400);
  }

  const db = createDb(ctx.env.DB);
  const [row] = await db
    .update(people)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(people.id, id))
    .returning();

  if (!row) return ctx.json({ error: "Person not found" }, 404);
  return ctx.json(row);
});

/** DELETE /:id — delete person. record_people links are cleaned up. */
route.delete("/:id", async (ctx) => {
  const id = parseId(ctx.req.param("id"));
  if (isNaN(id)) return ctx.json({ error: "Invalid ID" }, 400);
  const db = createDb(ctx.env.DB);

  // Clean up junction table links first (no cascade on person FK)
  await db.delete(recordPeople).where(eq(recordPeople.personId, id));

  const [row] = await db.delete(people).where(eq(people.id, id)).returning();
  if (!row) return ctx.json({ error: "Person not found" }, 404);
  return ctx.json({ ok: true });
});

export default route;
