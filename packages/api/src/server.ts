import { Hono } from "hono";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Invoice, Transaction, TransactionsFile } from "@slzr/shared";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = new Hono();
const DATA_DIR = path.resolve(__dirname, "../data");
const INVOICES_PATH = path.join(DATA_DIR, "invoices.json");
const TRANSACTIONS_PATH = path.join(DATA_DIR, "transactions.json");

// --- helpers ---

function readJSON<T>(filepath: string, fallback: T): T {
  if (!fs.existsSync(filepath)) return fallback;
  return JSON.parse(fs.readFileSync(filepath, "utf-8"));
}

function writeJSON(filepath: string, data: unknown) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

// --- transactions ---

app.get("/api/transactions", (c) => {
  const file = readJSON<TransactionsFile>(TRANSACTIONS_PATH, {
    statement: {},
    payment_info: {},
    transactions: [],
  });
  return c.json(file.transactions);
});

app.patch("/api/transactions/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const file = readJSON<TransactionsFile>(TRANSACTIONS_PATH, {
    statement: {},
    payment_info: {},
    transactions: [],
  });
  const tx = file.transactions.find((t) => t.id === id);
  if (!tx) return c.json({ error: "not found" }, 404);
  const body = await c.req.json();
  if (body.favor_for !== undefined) tx.favor_for = body.favor_for;
  writeJSON(TRANSACTIONS_PATH, file);
  return c.json(tx);
});

// --- invoices ---

app.get("/api/invoices", (c) => {
  return c.json(readJSON<Invoice[]>(INVOICES_PATH, []));
});

app.post("/api/invoices", async (c) => {
  const invoices = readJSON<Invoice[]>(INVOICES_PATH, []);
  const maxId = invoices.reduce((m, i) => Math.max(m, i.id), 0);
  const body = await c.req.json();
  const invoice: Invoice = {
    id: maxId + 1,
    date: body.date,
    store: body.store,
    amount: body.amount,
    currency: body.currency,
    notes: body.notes ?? "",
    linked_transaction_id: body.linked_transaction_id ?? null,
    favor_for: body.favor_for ?? null,
    created_at: new Date().toISOString(),
  };
  invoices.push(invoice);
  writeJSON(INVOICES_PATH, invoices);
  return c.json(invoice, 201);
});

app.put("/api/invoices/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const invoices = readJSON<Invoice[]>(INVOICES_PATH, []);
  const idx = invoices.findIndex((i) => i.id === id);
  if (idx === -1) return c.json({ error: "not found" }, 404);
  const body = await c.req.json();
  invoices[idx] = { ...invoices[idx], ...body, id };
  writeJSON(INVOICES_PATH, invoices);
  return c.json(invoices[idx]);
});

app.delete("/api/invoices/:id", (c) => {
  const id = Number(c.req.param("id"));
  let invoices = readJSON<Invoice[]>(INVOICES_PATH, []);
  invoices = invoices.filter((i) => i.id !== id);
  writeJSON(INVOICES_PATH, invoices);
  return c.json({ ok: true });
});

export default app;
