import { Hono } from "hono";
import { eq, and, gte, lte, desc, asc, gt, lt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { createRecordSchema, updateRecordSchema, reorderRecordSchema, parseRecordSchema, parseRecordFeedbackSchema } from "@slzr/expensr-shared";
import type { ParsedRecord, ResolvedBy } from "@slzr/expensr-shared";
import { createDb } from "../db";
import { records, accounts, categories, tags, people, recordPeople, parseLogs, keywordMappings } from "../db/schema";
import { parseId } from "../utils";

const route = new Hono<{ Bindings: CloudflareBindings }>();

/** Append current UTC time to a date-only string. Passthrough if already has time. */
function ensureDatetime(date: string): string {
  if (date.includes("T")) return date;
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
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
      linkedRecordId: records.linkedRecordId,
      note: records.note,
      myShares: records.myShares,
      splitType: records.splitType,
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

/** Attach people + share amounts to a list of records via record_people junction table. */
async function attachPeople<T extends { id: number }>(
  db: ReturnType<typeof createDb>,
  rows: T[],
): Promise<(T & { people: { id: number; name: string; shareAmount: number }[] })[]> {
  if (!rows.length) return rows.map((r) => ({ ...r, people: [] }));
  const recordIds = rows.map((r) => r.id);
  const links = await db
    .select({ recordId: recordPeople.recordId, personId: people.id, personName: people.name, shareAmount: recordPeople.shareAmount })
    .from(recordPeople)
    .innerJoin(people, eq(recordPeople.personId, people.id))
    .where(inArray(recordPeople.recordId, recordIds));

  const byRecord = new Map<number, { id: number; name: string; shareAmount: number }[]>();
  for (const link of links) {
    const list = byRecord.get(link.recordId) ?? [];
    list.push({ id: link.personId, name: link.personName, shareAmount: link.shareAmount });
    byRecord.set(link.recordId, list);
  }
  return rows.map((r) => ({ ...r, people: byRecord.get(r.id) ?? [] }));
}

/** Compute user's actual spending portion per record. Settlements = 0, shared = amount minus others' shares. */
function computeMySpend<T extends { amount: number; type: string; people: { shareAmount: number }[] }>(
  rows: T[],
): (T & { mySpend: number })[] {
  return rows.map((r) => {
    if (r.type === "settlement") return { ...r, mySpend: 0 };
    const othersTotal = r.people.reduce((sum, p) => sum + p.shareAmount, 0);
    return { ...r, mySpend: r.amount - othersTotal };
  });
}

/** Sync record_people links and pre-calculate share_amount per person. */
async function syncRecordPeople(
  db: ReturnType<typeof createDb>,
  recordId: number,
  personIds: number[],
  amount: number,
  myShares: number = 1,
  manualAmounts?: Map<number, number>,
) {
  await db.delete(recordPeople).where(eq(recordPeople.recordId, recordId));
  if (personIds.length) {
    if (manualAmounts?.size) {
      // Manual mode: use provided per-person amounts
      await db.insert(recordPeople).values(
        personIds.map((personId) => ({
          recordId, personId,
          shareAmount: manualAmounts.get(personId) ?? 0,
        })),
      );
    } else {
      // Equal/weighted: auto-calculate
      const shareAmount = amount / (personIds.length + myShares);
      await db.insert(recordPeople).values(
        personIds.map((personId) => ({ recordId, personId, shareAmount })),
      );
    }
  }
}

/** GET / — list records. Filters: ?accountId=1,2 ?dateFrom ?dateTo ?personId. Newest first. */
route.get("/", async (ctx) => {
  const db = createDb(ctx.env.DB);
  const { accountId, dateFrom, dateTo, personId } = ctx.req.query();

  const conditions = [];
  if (accountId) {
    const ids = accountId.split(",").map(Number).filter((n) => !isNaN(n));
    if (ids.length === 1) conditions.push(eq(records.accountId, ids[0]));
    else if (ids.length > 1) conditions.push(inArray(records.accountId, ids));
  }
  if (dateFrom) conditions.push(gte(records.date, filterDateFrom(dateFrom)));
  if (dateTo) conditions.push(lte(records.date, filterDateTo(dateTo)));

  // Filter by person — only records linked to this person via record_people
  if (personId) {
    const pid = Number(personId);
    if (!isNaN(pid)) {
      const personRecordIds = await db
        .select({ recordId: recordPeople.recordId })
        .from(recordPeople)
        .where(eq(recordPeople.personId, pid));
      const ids = personRecordIds.map((r) => r.recordId);
      if (ids.length) {
        conditions.push(inArray(records.id, ids));
      } else {
        return ctx.json([]);
      }
    }
  }

  const query = recordsWithRelations(db);
  const rows = conditions.length
    ? await query.where(and(...conditions)).orderBy(desc(records.date), desc(records.id))
    : await query.orderBy(desc(records.date), desc(records.id));

  return ctx.json(computeMySpend(await attachPeople(db, rows)));
});

/** POST / — create record. Appends current time if only date given. */
route.post("/", async (ctx) => {
  const body = await ctx.req.json();
  const parsed = createRecordSchema.safeParse(body);

  if (!parsed.success) {
    return ctx.json({ error: z.treeifyError(parsed.error) }, 400);
  }

  const db = createDb(ctx.env.DB);
  const { personIds, personShares, ...data } = parsed.data;

  // Determine split type from input
  let splitType = "equal";
  if (personShares?.length || (data.type === "settlement" && personIds?.length === 1)) {
    splitType = "manual";
  } else if (data.myShares && data.myShares > 1) {
    splitType = "weighted";
  }

  // Settlements require exactly one person
  if (data.type === "settlement" && (!personIds?.length || personIds.length !== 1)) {
    return ctx.json({ error: "Settlement requires exactly one person", code: "SETTLEMENT_ONE_PERSON" }, 400);
  }

  const [row] = await db.insert(records).values({ ...data, splitType, date: ensureDatetime(data.date) }).returning();

  if (personShares?.length) {
    // Manual mode: use provided per-person amounts
    const manualAmounts = new Map(personShares.map((s) => [s.personId, s.amount]));
    const ids = personShares.map((s) => s.personId);
    await syncRecordPeople(db, row.id, ids, row.amount, row.myShares, manualAmounts);
  } else if (data.type === "settlement" && personIds?.length === 1) {
    // Settlement: person's share = full amount
    const manualAmounts = new Map([[personIds[0], row.amount]]);
    await syncRecordPeople(db, row.id, personIds, row.amount, 1, manualAmounts);
  } else if (personIds?.length) {
    // Equal/weighted: auto-calculate
    await syncRecordPeople(db, row.id, personIds, row.amount, row.myShares);
  }
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

/** Match text against account aliases (exact) then names (partial). Aliases take priority. */
function matchAccount<T extends { name: string; aliases: string | null }>(
  text: string,
  allAccounts: T[],
): T | null {
  const lower = text.toLowerCase();
  // Exact alias match first (e.g. "usd" → Galicia USD)
  const aliasMatch = allAccounts.find((a) => a.aliases?.split(",").includes(lower));
  if (aliasMatch) return aliasMatch;
  // Partial name match — require search term to be a significant portion of the name
  // to avoid "ml" matching "MercadoLibre" while "galicia" still matches "Galicia ARS"
  return allAccounts.find((a) => {
    const nameLower = a.name.toLowerCase();
    if (nameLower.includes(lower) && lower.length >= nameLower.length * 0.4) return true;
    if (lower.includes(nameLower)) return true;
    return false;
  }) ?? null;
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

  // Extract /N (total shares) before other parsing — e.g. "102000 padel angy /5"
  let totalSharesHint: number | null = null;
  const sharesMatch = text.match(/\s\/(\d+)\s*$/);
  if (sharesMatch) {
    totalSharesHint = parseInt(sharesMatch[1]);
    text = text.slice(0, sharesMatch.index).trim();
  }

  const { text: t1, needsReview } = extractNeedsReview(text);
  const { text: t2, accountText } = extractParensAccount(t1);
  const { text: t3, date } = extractDate(t2);
  const { text: noteText, amount } = extractAmount(t3);

  let note = noteText.trim() || null;
  const keywords = extractKeywords(noteText);

  const [mappings, allTags, allAccounts, allCategories, allPeople] = await Promise.all([
    keywords.length
      ? db.select().from(keywordMappings).where(inArray(keywordMappings.keyword, keywords))
      : Promise.resolve([]),
    db.select({ id: tags.id, name: tags.name, categoryId: tags.categoryId, categoryName: categories.name })
      .from(tags)
      .leftJoin(categories, eq(tags.categoryId, categories.id))
      .orderBy(tags.name),
    db.select({
        id: accounts.id, name: accounts.name, currency: accounts.currency,
        aliases: accounts.aliases, isDefault: accounts.isDefault,
        recordCount: sql<number>`count(${records.id})`.as("recordCount"),
      })
      .from(accounts)
      .leftJoin(records, eq(accounts.id, records.accountId))
      .groupBy(accounts.id)
      .orderBy(accounts.name),
    db.select({ id: categories.id, name: categories.name })
      .from(categories)
      .orderBy(categories.name),
    db.select({ id: people.id, name: people.name }).from(people),
  ]);

  const sorted = mappings.sort((a, b) => b.usageCount - a.usageCount);

  // --- Account resolution: (parens) → note words → keyword map → default ---
  let resolvedAccount: typeof allAccounts[number] | null = null;

  if (accountText) {
    resolvedAccount = matchAccount(accountText, allAccounts);
    // Parens didn't match any account — put text back into note
    if (!resolvedAccount) {
      note = note ? `${note} ${accountText}` : accountText;
    }
  }

  // Note word match — checks aliases then names via matchAccount
  if (!resolvedAccount && note) {
    const noteWords = note.toLowerCase().split(/\s+/);
    for (const word of noteWords) {
      if (word.length < 2) continue;
      const match = matchAccount(word, allAccounts);
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

  // Default: explicit isDefault → most-used account (highest record count)
  if (!resolvedAccount && allAccounts.length) {
    resolvedAccount = allAccounts.find((a) => a.isDefault)
      ?? [...allAccounts].sort((a, b) => b.recordCount - a.recordCount)[0];
  }

  // --- Tag resolution: tag name match → keyword map → AI fallback ---
  let resolvedTagId: number | null = null;
  let resolvedBy: ResolvedBy = "none";
  let aiCalled = false;
  let aiSucceeded = false;

  // 1. Tag name match — exact first, then partial (contains)
  if (keywords.length) {
    // Exact match takes priority: "uber" → Uber
    for (const kw of keywords) {
      const exact = allTags.find((t) => t.name.toLowerCase() === kw);
      if (exact) { resolvedTagId = exact.id; break; }
    }
    // Partial: "super" → Supermercado, "mercado" → Supermercado
    if (!resolvedTagId) {
      for (const kw of keywords) {
        const partial = allTags.find((t) => t.name.toLowerCase().includes(kw) || kw.includes(t.name.toLowerCase()));
        if (partial) { resolvedTagId = partial.id; break; }
      }
    }
    if (resolvedTagId) resolvedBy = "name_match";
  }

  // 2. Keyword dictionary lookup
  if (!resolvedTagId) {
    const kwTag = sorted.find((m) => m.tagId);
    if (kwTag) {
      resolvedTagId = kwTag.tagId;
      resolvedBy = "keyword";
    }
  }

  let matchedTag = resolvedTagId ? allTags.find((t) => t.id === resolvedTagId) ?? null : null;
  let matchedCategory = matchedTag?.categoryId
    ? allCategories.find((c) => c.id === matchedTag!.categoryId) ?? null
    : null;

  // 3. AI fallback — only when name + keywords didn't resolve a tag
  if (!matchedTag && note) {
    aiCalled = true;
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
            matchedTag = aiTag;
            aiSucceeded = true;
            resolvedBy = "ai";
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

  // Bump usage_count for matched keywords (fire-and-forget, ranks future lookups)
  const usedIds = sorted.filter((m) => m.tagId || m.accountId).map((m) => m.id);
  if (usedIds.length) {
    ctx.executionCtx.waitUntil(
      db.update(keywordMappings)
        .set({ usageCount: sql`usage_count + 1`, updatedAt: new Date() })
        .where(inArray(keywordMappings.id, usedIds))
    );
  }

  // --- Person detection: match note keywords against people names ---
  const matchedPeople: { id: number; name: string }[] = [];
  if (keywords.length && allPeople.length) {
    for (const person of allPeople) {
      const personLower = person.name.toLowerCase();
      if (keywords.some((kw) => personLower.includes(kw) || kw.includes(personLower))) {
        matchedPeople.push(person);
      }
    }
  }

  // Calculate myShares from /N hint: myShares = totalShares - matchedPeople
  let myShares = 1;
  if (totalSharesHint && matchedPeople.length) {
    const calculated = totalSharesHint - matchedPeople.length;
    if (calculated >= 1) myShares = calculated;
  }

  const result: Omit<ParsedRecord, "parseLogId"> = {
    amount,
    tagId: matchedTag?.id ?? null,
    tagName: matchedTag?.name ?? null,
    categoryId: matchedCategory?.id ?? null,
    categoryName: matchedCategory?.name ?? null,
    accountId: resolvedAccount?.id ?? null,
    accountName: resolvedAccount?.name ?? null,
    note,
    date,
    personIds: matchedPeople.map((p) => p.id),
    personNames: matchedPeople.map((p) => p.name),
    myShares,
    splitType: myShares > 1 ? "weighted" : "equal",
    type: matchedCategory?.name === "Income" ? "income" : "expense",
    needsReview,
    resolvedBy,
  };

  // Log every parse call for observability and feedback wiring
  const log = await db.insert(parseLogs).values({
    inputText: parsed.data.text,
    resolvedBy,
    tagMatched: !!matchedTag,
    accountMatched: !!resolvedAccount,
    peopleCount: matchedPeople.length,
    aiCalled,
    aiSucceeded: aiCalled ? aiSucceeded : null,
    parseResult: JSON.stringify(result),
  }).returning().get();

  return ctx.json({ ...result, parseLogId: log.id });
});

/** GET /parse/keywords — learned keyword→tag mappings for form auto-matching. */
route.get("/parse/keywords", async (ctx) => {
  const db = createDb(ctx.env.DB);
  const rows = await db
    .select({
      keyword: keywordMappings.keyword,
      tagId: keywordMappings.tagId,
      tagName: tags.name,
    })
    .from(keywordMappings)
    .innerJoin(tags, eq(keywordMappings.tagId, tags.id))
    .orderBy(desc(keywordMappings.usageCount));
  return ctx.json(rows);
});

/** GET /parse/stats — aggregate parse observability metrics. */
route.get("/parse/stats", async (ctx) => {
  const db = createDb(ctx.env.DB);
  const stats = await db.select({
    total: sql<number>`count(*)`,
    nameMatch: sql<number>`count(case when ${parseLogs.resolvedBy} = 'name_match' then 1 end)`,
    keyword: sql<number>`count(case when ${parseLogs.resolvedBy} = 'keyword' then 1 end)`,
    ai: sql<number>`count(case when ${parseLogs.resolvedBy} = 'ai' then 1 end)`,
    none: sql<number>`count(case when ${parseLogs.resolvedBy} = 'none' then 1 end)`,
    aiCalls: sql<number>`count(case when ${parseLogs.aiCalled} then 1 end)`,
    aiSuccess: sql<number>`count(case when ${parseLogs.aiSucceeded} then 1 end)`,
    corrected: sql<number>`count(case when ${parseLogs.wasCorrected} then 1 end)`,
    saved: sql<number>`count(${parseLogs.finalResult})`,
  }).from(parseLogs).get();
  return ctx.json(stats);
});

/** GET /:id */
route.get("/:id", async (ctx) => {
  const id = parseId(ctx.req.param("id"));
  if (isNaN(id)) return ctx.json({ error: "Invalid ID" }, 400);
  const db = createDb(ctx.env.DB);

  const row = await recordsWithRelations(db).where(eq(records.id, id)).get();

  if (!row) return ctx.json({ error: "Record not found" }, 404);
  const [withPeople] = computeMySpend(await attachPeople(db, [row]));
  return ctx.json(withPeople);
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

  const { personIds, personShares, ...updates } = { ...parsed.data, updatedAt: new Date() };

  // Determine split type override
  const splitTypeOverride: Record<string, string> = {};
  if (personShares?.length) {
    splitTypeOverride.splitType = "manual";
  } else if (updates.myShares && updates.myShares > 1) {
    splitTypeOverride.splitType = "weighted";
  } else if (personIds !== undefined && !personShares) {
    splitTypeOverride.splitType = "equal";
  }

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
    .set({ ...updates, ...splitTypeOverride })
    .where(eq(records.id, id))
    .returning();

  if (!row) return ctx.json({ error: "Record not found" }, 404);

  // Sync people and share_amounts
  if (personShares?.length) {
    // Manual mode: use provided per-person amounts
    const manualAmounts = new Map(personShares.map((s) => [s.personId, s.amount]));
    const ids = personShares.map((s) => s.personId);
    await syncRecordPeople(db, id, ids, row.amount, row.myShares, manualAmounts);
  } else if (personIds !== undefined) {
    // People explicitly changed — sync with equal/weighted calculation
    await syncRecordPeople(db, id, personIds, row.amount, row.myShares);
  } else if (row.splitType !== "manual" && (updates.amount !== undefined || updates.myShares !== undefined)) {
    // Amount or myShares changed on non-manual record — recalculate
    const currentPeople = await db
      .select({ personId: recordPeople.personId })
      .from(recordPeople)
      .where(eq(recordPeople.recordId, id));
    if (currentPeople.length) {
      await syncRecordPeople(db, id, currentPeople.map((p) => p.personId), row.amount, row.myShares);
    }
  }
  // Manual records: don't recalculate when amount changes (amounts are explicit)

  return ctx.json(row);
});

/**
 * POST /parse/feedback — update log row with final result, build keyword dictionary.
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
  const { parseLogId, finalResponse } = parsed.data;

  // Fetch the log row to get original input text and parse result
  const logRow = await db.select().from(parseLogs).where(eq(parseLogs.id, parseLogId)).get();
  if (!logRow) return ctx.json({ error: "Parse log not found" }, 404);

  // Compare original vs final to determine if user corrected the parse
  const original = JSON.parse(logRow.parseResult) as Record<string, unknown>;
  const wasCorrected = original.tagId !== finalResponse.tagId
    || original.accountId !== finalResponse.accountId;

  // Update log row with feedback
  await db.update(parseLogs).set({
    finalResult: JSON.stringify(finalResponse),
    wasCorrected,
  }).where(eq(parseLogs.id, parseLogId));

  // Re-run extraction to get keywords from the original input
  const { text: t1 } = extractNeedsReview(logRow.inputText);
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
