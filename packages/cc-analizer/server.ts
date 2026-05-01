import express from "express";
import fs from "fs";
import path from "path";
import type { Invoice, Transaction, TransactionsFile } from "./types.js";

const app = express();
const PORT = 3000;
const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, "data");

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

/** Resolves paths for a given statement key (e.g. "visa-2026-04"). */
function statementPaths(key: string) {
  return {
    transactions: path.join(DATA_DIR, `${key}.json`),
    invoices: path.join(DATA_DIR, `invoices-${key}.json`),
  };
}

// --- statements list (for switching between periods) ---

app.get("/api/statements", (_req, res) => {
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json") && !f.startsWith("invoices-"));
  const statements = files.map((f) => {
    const key = f.replace(".json", "");
    const data = readJSON<TransactionsFile>(path.join(DATA_DIR, f), { statement: {}, payment_info: {}, transactions: [] });
    return {
      key,
      label: `${(data.statement as any)?.card ?? "Card"} — ${(data.statement as any)?.period?.current_close ?? key}`,
      transactionCount: data.transactions.length,
      totalArs: (data.statement as any)?.total_ars ?? null,
      totalUsd: (data.statement as any)?.total_usd ?? null,
    };
  });
  res.json(statements);
});

// --- transactions (scoped by statement key) ---

app.get("/api/transactions", (req, res) => {
  const key = (req.query.statement as string) || getDefaultKey();
  const paths = statementPaths(key);
  const file = readJSON<TransactionsFile>(paths.transactions, { statement: {}, payment_info: {}, transactions: [] });
  res.json({ ...file, key });
});

app.patch("/api/transactions/:id", (req, res) => {
  const key = (req.query.statement as string) || getDefaultKey();
  const paths = statementPaths(key);
  const id = Number(req.params.id);
  const file = readJSON<TransactionsFile>(paths.transactions, { statement: {}, payment_info: {}, transactions: [] });
  const tx = file.transactions.find((t) => t.id === id);
  if (!tx) { res.status(404).json({ error: "not found" }); return; }
  if (req.body.favor_for !== undefined) tx.favor_for = req.body.favor_for;
  writeJSON(paths.transactions, file);
  res.json(tx);
});

// --- invoices (scoped by statement key) ---

app.get("/api/invoices", (req, res) => {
  const key = (req.query.statement as string) || getDefaultKey();
  const paths = statementPaths(key);
  res.json(readJSON<Invoice[]>(paths.invoices, []));
});

app.post("/api/invoices", (req, res) => {
  const key = (req.query.statement as string) || getDefaultKey();
  const paths = statementPaths(key);
  const invoices = readJSON<Invoice[]>(paths.invoices, []);
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
  writeJSON(paths.invoices, invoices);
  res.status(201).json(invoice);
});

app.put("/api/invoices/:id", (req, res) => {
  const key = (req.query.statement as string) || getDefaultKey();
  const paths = statementPaths(key);
  const id = Number(req.params.id);
  const invoices = readJSON<Invoice[]>(paths.invoices, []);
  const idx = invoices.findIndex((i) => i.id === id);
  if (idx === -1) { res.status(404).json({ error: "not found" }); return; }
  invoices[idx] = { ...invoices[idx], ...req.body, id };
  writeJSON(paths.invoices, invoices);
  res.json(invoices[idx]);
});

app.delete("/api/invoices/:id", (req, res) => {
  const key = (req.query.statement as string) || getDefaultKey();
  const paths = statementPaths(key);
  const id = Number(req.params.id);
  let invoices = readJSON<Invoice[]>(paths.invoices, []);
  invoices = invoices.filter((i) => i.id !== id);
  writeJSON(paths.invoices, invoices);
  res.json({ ok: true });
});

// --- default statement key (most recent file) ---

function getDefaultKey(): string {
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json") && !f.startsWith("invoices-")).sort();
  return files.length ? files[files.length - 1]!.replace(".json", "") : "transactions";
}

// --- start ---

function start(port: number) {
  const server = app.listen(port, () => {
    console.log(`http://localhost:${port}`);
  });
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.log(`Port ${port} in use, trying ${port + 1}...`);
      start(port + 1);
    } else throw err;
  });
  process.on("SIGINT", () => {
    server.close(() => process.exit(0));
  });
}
start(PORT);
