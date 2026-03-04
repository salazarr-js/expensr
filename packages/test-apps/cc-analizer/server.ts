import express from "express";
import fs from "fs";
import path from "path";
import type { Invoice, Transaction, TransactionsFile } from "./types.js";

const app = express();
const PORT = 3000;
const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, "data");
const INVOICES_PATH = path.join(DATA_DIR, "invoices.json");
const TRANSACTIONS_PATH = path.join(DATA_DIR, "transactions.json");

app.use(express.json());
app.use(express.static(path.join(ROOT_DIR, "public")));

// --- helpers ---

function readJSON<T>(filepath: string, fallback: T): T {
  if (!fs.existsSync(filepath)) return fallback;
  return JSON.parse(fs.readFileSync(filepath, "utf-8"));
}

function writeJSON(filepath: string, data: unknown) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

// --- transactions ---

app.get("/api/transactions", (_req, res) => {
  const file = readJSON<TransactionsFile>(TRANSACTIONS_PATH, {
    statement: {},
    payment_info: {},
    transactions: [],
  });
  res.json(file.transactions);
});

app.patch("/api/transactions/:id", (req, res) => {
  const id = Number(req.params.id);
  const file = readJSON<TransactionsFile>(TRANSACTIONS_PATH, {
    statement: {},
    payment_info: {},
    transactions: [],
  });
  const tx = file.transactions.find((t) => t.id === id);
  if (!tx) {
    res.status(404).json({ error: "not found" });
    return;
  }
  if (req.body.favor_for !== undefined) tx.favor_for = req.body.favor_for;
  writeJSON(TRANSACTIONS_PATH, file);
  res.json(tx);
});

// --- invoices ---

app.get("/api/invoices", (_req, res) => {
  res.json(readJSON<Invoice[]>(INVOICES_PATH, []));
});

app.post("/api/invoices", (req, res) => {
  const invoices = readJSON<Invoice[]>(INVOICES_PATH, []);
  const maxId = invoices.reduce((m, i) => Math.max(m, i.id), 0);
  const invoice: Invoice = {
    id: maxId + 1,
    date: req.body.date,
    store: req.body.store,
    amount: req.body.amount,
    currency: req.body.currency,
    notes: req.body.notes ?? "",
    linked_transaction_id: req.body.linked_transaction_id ?? null,
    favor_for: req.body.favor_for ?? null,
    created_at: new Date().toISOString(),
  };
  invoices.push(invoice);
  writeJSON(INVOICES_PATH, invoices);
  res.status(201).json(invoice);
});

app.put("/api/invoices/:id", (req, res) => {
  const id = Number(req.params.id);
  const invoices = readJSON<Invoice[]>(INVOICES_PATH, []);
  const idx = invoices.findIndex((i) => i.id === id);
  if (idx === -1) {
    res.status(404).json({ error: "not found" });
    return;
  }
  invoices[idx] = { ...invoices[idx], ...req.body, id };
  writeJSON(INVOICES_PATH, invoices);
  res.json(invoices[idx]);
});

app.delete("/api/invoices/:id", (req, res) => {
  const id = Number(req.params.id);
  let invoices = readJSON<Invoice[]>(INVOICES_PATH, []);
  invoices = invoices.filter((i) => i.id !== id);
  writeJSON(INVOICES_PATH, invoices);
  res.json({ ok: true });
});

const server = await app.listen(PORT);
console.log(`http://localhost:${PORT}`);
