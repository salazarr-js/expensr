import { Hono } from "hono";
import { eq, and, gte, lte, desc, asc, gt, lt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { createRecordSchema, updateRecordSchema, reorderRecordSchema, parseRecordSchema, parseRecordFeedbackSchema } from "@slzr/expensr-shared";
import type { ParsedRecord } from "@slzr/expensr-shared";
import { createDb } from "../db";
import { records } from "../db/schema";
import { accounts } from "../db/schema";
import { categories } from "../db/schema";
import { tags } from "../db/schema";
import { parseCorrections } from "../db/schema";
import { keywordMappings } from "../db/schema";
import { parseId } from "../utils";

const route = new Hono<{ Bindings: CloudflareBindings }>();

/** Append current time to a date-only string. Passthrough if already has time. */
function ensureDatetime(date: string): string {
  if (date.includes("T")) return date;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${date}T${hh}:${mm}:${ss}`;
}

/** Expand date-only filters to start/end of day for datetime range queries. */
function filterDateFrom(d: string): string {
  return d.includes("T") ? d : `${d}T00:00:00`;
}
function filterDateTo(d: string): string {
  return d.includes("T") ? d : `${d}T23:59:59`;
}

/** Datetime string → Unix seconds. Appends "Z" to force UTC (avoids timezone shifts). */
function toUnix(dt: string): number {
  return Date.parse(dt.endsWith("Z") ? dt : dt + "Z") / 1000;
}

/** Unix seconds → "YYYY-MM-DDTHH:MM:SS" (no Z suffix — matches our storage format). */
function fromUnix(secs: number): string {
  return new Date(secs * 1000).toISOString().slice(0, 19);
}

/** Base SELECT with joined relation names. Shared by list and detail endpoints. */
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
      needsReview: records.needsReview,
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

/** GET / — list records. Filters: ?accountId=1,2 ?dateFrom ?dateTo. Newest first. */
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

/** POST / — create record. Appends current time if only date given. */
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

// --- Smart parse: token extractors (pure, no DB) ---

/** Strip ??/??? markers. Single ? is ignored. */
function extractNeedsReview(text: string): { text: string; needsReview: boolean } {
  const needsReview = /\?\?+/.test(text);
  return { text: text.replace(/\?\?+/g, "").replace(/\s+/g, " ").trim(), needsReview };
}

/** Extract (parens) as account hint. If no match, caller restores text to note. */
function extractParensAccount(text: string): { text: string; accountText: string | null } {
  const match = text.match(/\(([^)]+)\)/);
  if (!match) return { text, accountText: null };
  return {
    text: text.replace(match[0], "").replace(/\s+/g, " ").trim(),
    accountText: match[1].trim(),
  };
}

/** Extract DD/MM/YY or DD/MM date. Two-digit year → 20xx, no year → current year. */
function extractDate(text: string): { text: string; date: string | null } {
  const match = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (!match) return { text, date: null };

  const day = parseInt(match[1]);
  const month = parseInt(match[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return { text, date: null };

  let year: number;
  if (match[3]) {
    year = match[3].length === 2 ? 2000 + parseInt(match[3]) : parseInt(match[3]);
  } else {
    year = new Date().getFullYear();
  }

  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { text: text.replace(match[0], "").replace(/\s+/g, " ").trim(), date: iso };
}

/** Last standalone number in text. Skips glued tokens like "150usd". Always absolute value. */
function extractAmount(text: string): { amount: number | null; text: string } {
  const tokens = text.split(/\s+/);
  let amountIdx = -1;
  let amount: number | null = null;

  // Right-to-left: last number wins (e.g. "exchange 150usd 204750" → 204750)
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (/^-?[\d.,]+$/.test(tokens[i])) {
      amount = parseFloat(tokens[i].replace(",", ""));
      if (!isNaN(amount)) {
        amountIdx = i;
        break;
      }
    }
  }

  if (amountIdx === -1) return { amount: null, text };
  const remaining = tokens.filter((_, i) => i !== amountIdx).join(" ");
  return { amount: Math.abs(amount!), text: remaining };
}

/** Lowercase words ≥3 chars, excluding numbers. For keyword dictionary lookup. */
function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !/^-?[\d.,]+$/.test(w));
}

/** Bidirectional partial match: "galicia" ↔ "Galicia ARS", "mercado" ↔ "MercadoLibre". */
function matchAccount(
  text: string,
  allAccounts: { id: number; name: string; currency: string }[],
): { id: number; name: string; currency: string } | null {
  const lower = text.toLowerCase();
  return allAccounts.find((a) => a.name.toLowerCase().includes(lower)
    || lower.includes(a.name.toLowerCase())) ?? null;
}

/**
 * POST /parse — smart parse natural language → structured record.
 * Account: (parens) → note words → keyword map → default.
 * Tag: keyword map → AI fallback. See docs/smart-parse.md.
 */
route.post("/parse", async (ctx) => {
  const body = await ctx.req.json();
  const parsed = parseRecordSchema.safeParse(body);

  if (!parsed.success) {
    return ctx.json({ error: z.treeifyError(parsed.error) }, 400);
  }

  const db = createDb(ctx.env.DB);

  // Extraction order matters: each step strips its match, remainder becomes the note
  let text = parsed.data.text;
  const { text: t1, needsReview } = extractNeedsReview(text);
  const { text: t2, accountText } = extractParensAccount(t1);
  const { text: t3, date } = extractDate(t2);
  const { text: noteText, amount } = extractAmount(t3);

  let note = noteText.trim() || null;
  const keywords = extractKeywords(noteText);

  const [mappings, allTags, allAccounts, allCategories] = await Promise.all([
    keywords.length
      ? db.select().from(keywordMappings).where(inArray(keywordMappings.keyword, keywords))
      : Promise.resolve([]),
    db.select({ id: tags.id, name: tags.name, categoryId: tags.categoryId, categoryName: categories.name })
      .from(tags)
      .leftJoin(categories, eq(tags.categoryId, categories.id))
      .orderBy(tags.name),
    db.select({ id: accounts.id, name: accounts.name, currency: accounts.currency })
      .from(accounts)
      .orderBy(accounts.name),
    db.select({ id: categories.id, name: categories.name })
      .from(categories)
      .orderBy(categories.name),
  ]);

  const sorted = mappings.sort((a, b) => b.usageCount - a.usageCount);

  // --- Account resolution: (parens) → note words → keyword map → default ---
  let resolvedAccount: { id: number; name: string; currency: string } | null = null;

  if (accountText) {
    resolvedAccount = matchAccount(accountText, allAccounts);
    // Parens didn't match any account — put text back into note
    if (!resolvedAccount) {
      note = note ? `${note} ${accountText}` : accountText;
    }
  }

  if (!resolvedAccount && note) {
    const noteWords = note.toLowerCase().split(/\s+/);
    for (const word of noteWords) {
      if (word.length < 3) continue;
      const match = allAccounts.find((a) => a.name.toLowerCase().includes(word)
        || word.includes(a.name.toLowerCase()));
      if (match) {
        resolvedAccount = match;
        break;
      }
    }
  }

  if (!resolvedAccount) {
    const kwAccountId = sorted.find((m) => m.accountId)?.accountId ?? null;
    if (kwAccountId) {
      resolvedAccount = allAccounts.find((a) => a.id === kwAccountId) ?? null;
    }
  }

  if (!resolvedAccount && allAccounts.length) {
    resolvedAccount = allAccounts[0];
  }

  // --- Tag resolution: keyword map → AI fallback ---
  let resolvedTagId: number | null = null;

  const kwTag = sorted.find((m) => m.tagId);
  if (kwTag) resolvedTagId = kwTag.tagId;

  const matchedTag = resolvedTagId ? allTags.find((t) => t.id === resolvedTagId) ?? null : null;
  let matchedCategory = matchedTag?.categoryId
    ? allCategories.find((c) => c.id === matchedTag.categoryId) ?? null
    : null;

  // AI fallback — only when keywords didn't resolve a tag
  if (!matchedTag && note) {
    // Include learned keyword→tag dictionary in the prompt so AI can leverage it
    const allMappings = await db.select().from(keywordMappings).orderBy(desc(keywordMappings.usageCount));
    const tagMap = new Map(allTags.map((t) => [t.id, t.name]));

    const dictionaryEntries = allMappings
      .map((m) => {
        if (m.tagId) return `${m.keyword}→${tagMap.get(m.tagId) || "?"}`;
        return null;
      })
      .filter(Boolean);

    const dictionarySection = dictionaryEntries.length
      ? `\nKnown keywords (PRIORITIZE these): ${dictionaryEntries.join(", ")}`
      : "";

    const tagList = allTags.map((t) => `${t.name}(${t.categoryName})`).join(",");
    const incomeTags = allTags
      .filter((t) => t.categoryName === "Income")
      .map((t) => t.name)
      .join(",");

    const systemPrompt = `Match this expense description to a tag. Return ONLY valid JSON, no explanation.

Tags(category): ${tagList}
Income tags: ${incomeTags || "none"}

Rules:
- Match tag by exact or partial name (uber→Uber, netflix→Subscriptions, sushi→Restaurante)
- type=income if tag is in Income category, else expense
- Return null if no tag matches
${dictionarySection}
Output format: {"tagName":string|null,"type":"expense"|"income"}`;

    try {
      const ai = ctx.env.AI;
      const response = await ai.run("@cf/meta/llama-3.1-8b-instruct-fp8", {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: note },
        ],
        max_tokens: 80,
      });

      const responseText = response.response ?? "";
      // AI may wrap JSON in extra text — extract the first {...} block
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const aiResult = JSON.parse(jsonMatch[0]) as { tagName?: string; type?: string };
        if (aiResult.tagName) {
          const aiTag = allTags.find((t) => t.name.toLowerCase() === aiResult.tagName!.toLowerCase());
          if (aiTag) {
            resolvedTagId = aiTag.id;
            matchedCategory = aiTag.categoryId
              ? allCategories.find((c) => c.id === aiTag.categoryId) ?? null
              : null;
          }
        }
      }
    } catch {
      // AI failed — continue without tag, user will pick in the form
    }
  }

  const finalTag = resolvedTagId ? allTags.find((t) => t.id === resolvedTagId) ?? null : null;

  // Bump usage_count for matched keywords (fire-and-forget, ranks future lookups)
  const usedIds = sorted.filter((m) => m.tagId || m.accountId).map((m) => m.id);
  if (usedIds.length) {
    ctx.executionCtx.waitUntil(
      db.update(keywordMappings)
        .set({ usageCount: sql`usage_count + 1`, updatedAt: new Date() })
        .where(inArray(keywordMappings.id, usedIds))
    );
  }

  const result: ParsedRecord = {
    amount,
    tagId: finalTag?.id ?? null,
    tagName: finalTag?.name ?? null,
    categoryId: matchedCategory?.id ?? null,
    categoryName: matchedCategory?.name ?? null,
    accountId: resolvedAccount?.id ?? null,
    accountName: resolvedAccount?.name ?? null,
    note,
    date,
    type: matchedCategory?.name === "Income" ? "income" : "expense",
    needsReview,
  };

  return ctx.json(result);
});

/** GET /:id */
route.get("/:id", async (ctx) => {
  const id = parseId(ctx.req.param("id"));
  if (isNaN(id)) return ctx.json({ error: "Invalid ID" }, 400);
  const db = createDb(ctx.env.DB);

  const row = await recordsWithRelations(db).where(eq(records.id, id)).get();

  if (!row) return ctx.json({ error: "Record not found" }, 404);
  return ctx.json(row);
});

/** PUT /:id — partial update. Preserves time when only date changes. */
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

/**
 * POST /parse/feedback — store correction, build keyword dictionary.
 * Only maps keywords for 1-2 word notes (brands). Multi-word notes are too ambiguous.
 * Parens account keywords are always mapped.
 */
route.post("/parse/feedback", async (ctx) => {
  const body = await ctx.req.json();
  const parsed = parseRecordFeedbackSchema.safeParse(body);

  if (!parsed.success) {
    return ctx.json({ error: z.treeifyError(parsed.error) }, 400);
  }

  const db = createDb(ctx.env.DB);
  const { promptText, aiResponse, finalResponse } = parsed.data;

  await db.insert(parseCorrections).values({
    promptText,
    aiResponse: JSON.stringify(aiResponse),
    finalResponse: JSON.stringify(finalResponse),
  });

  // Re-run extraction to get keywords from the original prompt
  const { text: t1 } = extractNeedsReview(promptText);
  const { text: t2, accountText } = extractParensAccount(t1);
  const { text: t3 } = extractDate(t2);
  const { text: noteText } = extractAmount(t3);
  const keywords = extractKeywords(noteText);

  const tagId = (finalResponse as Record<string, unknown>).tagId as number | null;
  const accountId = (finalResponse as Record<string, unknown>).accountId as number | null;

  const shouldMapTag = tagId && keywords.length <= 2;
  const accountKeywords = accountText ? extractKeywords(accountText) : [];

  if (shouldMapTag) {
    for (const keyword of keywords) {
      await upsertKeywordMapping(db, keyword, { tagId });
    }
  }

  if (accountId && accountKeywords.length) {
    for (const keyword of accountKeywords) {
      await upsertKeywordMapping(db, keyword, { accountId });
    }
  }

  if (accountId && !accountText && keywords.length <= 2) {
    for (const keyword of keywords) {
      await upsertKeywordMapping(db, keyword, { accountId });
    }
  }

  return ctx.json({ ok: true });
});

/** Upsert keyword mapping. Merges tagId/accountId and bumps usageCount on existing. */
async function upsertKeywordMapping(
  db: ReturnType<typeof createDb>,
  keyword: string,
  mapping: { tagId?: number | null; accountId?: number | null },
) {
  const existing = await db
    .select()
    .from(keywordMappings)
    .where(eq(keywordMappings.keyword, keyword))
    .get();

  if (existing) {
    await db
      .update(keywordMappings)
      .set({
        ...(mapping.tagId ? { tagId: mapping.tagId } : {}),
        ...(mapping.accountId ? { accountId: mapping.accountId } : {}),
        usageCount: existing.usageCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(keywordMappings.id, existing.id));
  } else {
    await db.insert(keywordMappings).values({
      keyword,
      tagId: mapping.tagId ?? null,
      accountId: mapping.accountId ?? null,
    });
  }
}

/** POST /reorder — move record by setting datetime to midpoint between neighbors. */
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
    const target = await db.select().from(records).where(eq(records.id, afterId)).get();
    if (!target) return ctx.json({ error: "Target record not found" }, 404);

    const below = await db
      .select()
      .from(records)
      .where(lt(records.date, target.date))
      .orderBy(desc(records.date))
      .limit(1)
      .get();

    const t1 = toUnix(target.date);
    if (below && below.id !== id) {
      newDatetime = fromUnix(Math.floor((t1 + toUnix(below.date)) / 2));
    } else {
      newDatetime = fromUnix(t1 - 1);
    }
  } else if (beforeId) {
    const target = await db.select().from(records).where(eq(records.id, beforeId)).get();
    if (!target) return ctx.json({ error: "Target record not found" }, 404);

    const above = await db
      .select()
      .from(records)
      .where(gt(records.date, target.date))
      .orderBy(asc(records.date))
      .limit(1)
      .get();

    const t1 = toUnix(target.date);
    if (above && above.id !== id) {
      newDatetime = fromUnix(Math.floor((t1 + toUnix(above.date)) / 2));
    } else {
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

/** DELETE /:id */
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
