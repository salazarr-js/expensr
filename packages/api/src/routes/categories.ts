import { Hono } from "hono";
import { eq, count } from "drizzle-orm";
import { z } from "zod";
import { createCategorySchema, updateCategorySchema, createTagSchema, updateTagSchema } from "@slzr/expensr-shared";
import { createDb } from "../db";
import { categories, tags } from "../db/schema";
import { isUniqueViolation, parseId } from "../utils";

const route = new Hono<{ Bindings: CloudflareBindings }>();

/** List all categories sorted by name, with tag count per category. */
route.get("/", async (ctx) => {
  const db = createDb(ctx.env.DB);

  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      color: categories.color,
      icon: categories.icon,
      createdAt: categories.createdAt,
      updatedAt: categories.updatedAt,
      tagCount: count(tags.id),
    })
    .from(categories)
    .leftJoin(tags, eq(tags.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(categories.name);

  return ctx.json(rows);
});

/** List all tags with category name. */
route.get("/tags", async (ctx) => {
  const db = createDb(ctx.env.DB);

  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      categoryId: tags.categoryId,
      icon: tags.icon,
      createdAt: tags.createdAt,
      updatedAt: tags.updatedAt,
      categoryName: categories.name,
    })
    .from(tags)
    .leftJoin(categories, eq(tags.categoryId, categories.id))
    .orderBy(tags.name);

  return ctx.json(rows);
});

/** Create a new category. */
route.post("/", async (ctx) => {
  const body = await ctx.req.json();
  const parsed = createCategorySchema.safeParse(body);

  if (!parsed.success) {
    return ctx.json({ error: z.treeifyError(parsed.error) }, 400);
  }

  const db = createDb(ctx.env.DB);

  try {
    const [row] = await db.insert(categories).values(parsed.data).returning();
    return ctx.json(row, 201);
  } catch (e: unknown) {
    if (isUniqueViolation(e)) {
      return ctx.json({ code: "DUPLICATE_NAME", error: "A category with this name already exists" }, 409);
    }
    throw e;
  }
});

/** Get a single category with its tags. */
route.get("/:id", async (ctx) => {
  const id = parseId(ctx.req.param("id"));
  if (isNaN(id)) return ctx.json({ error: "Invalid ID" }, 400);
  const db = createDb(ctx.env.DB);

  const row = await db.select().from(categories).where(eq(categories.id, id)).get();

  if (!row) return ctx.json({ error: "Category not found" }, 404);

  const categoryTags = await db.select().from(tags).where(eq(tags.categoryId, id)).orderBy(tags.name);

  return ctx.json({ ...row, tags: categoryTags });
});

/** Partially update a category by ID. */
route.put("/:id", async (ctx) => {
  const id = parseId(ctx.req.param("id"));
  if (isNaN(id)) return ctx.json({ error: "Invalid ID" }, 400);
  const body = await ctx.req.json();
  const parsed = updateCategorySchema.safeParse(body);

  if (!parsed.success) {
    return ctx.json({ error: z.treeifyError(parsed.error) }, 400);
  }

  const db = createDb(ctx.env.DB);

  try {
    const [row] = await db
      .update(categories)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();

    if (!row) return ctx.json({ error: "Category not found" }, 404);

    return ctx.json(row);
  } catch (e: unknown) {
    if (isUniqueViolation(e)) {
      return ctx.json({ code: "DUPLICATE_NAME", error: "A category with this name already exists" }, 409);
    }
    throw e;
  }
});

/** Delete a category and all its tags by ID. */
route.delete("/:id", async (ctx) => {
  const id = parseId(ctx.req.param("id"));
  if (isNaN(id)) return ctx.json({ error: "Invalid ID" }, 400);
  const db = createDb(ctx.env.DB);

  const row = await db.select().from(categories).where(eq(categories.id, id)).get();
  if (!row) return ctx.json({ error: "Category not found" }, 404);

  // Cascade: delete all tags under this category first
  await db.delete(tags).where(eq(tags.categoryId, id));
  await db.delete(categories).where(eq(categories.id, id));

  return ctx.json({ ok: true });
});

/** Create a tag under a category. */
route.post("/:categoryId/tags", async (ctx) => {
  const categoryId = parseId(ctx.req.param("categoryId"));
  if (isNaN(categoryId)) return ctx.json({ error: "Invalid ID" }, 400);
  const body = await ctx.req.json();

  // Verify the category exists
  const db = createDb(ctx.env.DB);
  const category = await db.select().from(categories).where(eq(categories.id, categoryId)).get();
  if (!category) return ctx.json({ error: "Category not found" }, 404);

  const parsed = createTagSchema.safeParse({ ...body, categoryId });

  if (!parsed.success) {
    return ctx.json({ error: z.treeifyError(parsed.error) }, 400);
  }

  try {
    const [row] = await db.insert(tags).values(parsed.data).returning();
    return ctx.json(row, 201);
  } catch (e: unknown) {
    if (isUniqueViolation(e)) {
      return ctx.json({ code: "DUPLICATE_NAME", error: "A tag with this name already exists" }, 409);
    }
    throw e;
  }
});

/** Update a tag by ID. */
route.put("/tags/:id", async (ctx) => {
  const id = parseId(ctx.req.param("id"));
  if (isNaN(id)) return ctx.json({ error: "Invalid ID" }, 400);
  const body = await ctx.req.json();
  const parsed = updateTagSchema.safeParse(body);

  if (!parsed.success) {
    return ctx.json({ error: z.treeifyError(parsed.error) }, 400);
  }

  const db = createDb(ctx.env.DB);

  try {
    const [row] = await db
      .update(tags)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(tags.id, id))
      .returning();

    if (!row) return ctx.json({ error: "Tag not found" }, 404);

    return ctx.json(row);
  } catch (e: unknown) {
    if (isUniqueViolation(e)) {
      return ctx.json({ code: "DUPLICATE_NAME", error: "A tag with this name already exists" }, 409);
    }
    throw e;
  }
});

/** Delete a tag by ID. */
route.delete("/tags/:id", async (ctx) => {
  const id = parseId(ctx.req.param("id"));
  if (isNaN(id)) return ctx.json({ error: "Invalid ID" }, 400);
  const db = createDb(ctx.env.DB);

  const [row] = await db
    .delete(tags)
    .where(eq(tags.id, id))
    .returning();

  if (!row) return ctx.json({ error: "Tag not found" }, 404);

  return ctx.json({ ok: true });
});

export default route;
