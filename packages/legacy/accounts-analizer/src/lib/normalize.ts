import type {
  RawData,
  NormalizedTransaction,
  TransactionCategory,
  SpendingCategory,
  OverridesFile,
} from "../types";
import { parseLocaleNumber, parseDateDash, parseDateSlash, toISODate } from "./parse";
import { categorizeDescription } from "./categories";
import { extractMerchantKey, extractMerchantName } from "./merchants";

// ---- Stable transaction IDs (djb2 hash) ----

function txId(source: string, dateStr: string, desc: string, amount: number): string {
  const raw = `${source}|${dateStr}|${desc}|${amount}`;
  let h = 5381;
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h + raw.charCodeAt(i)) >>> 0;
  return `${source.slice(0, 3)}-${h.toString(36)}`;
}

// ---- Structural category classification ----

function categorizeMPDescription(desc: string): TransactionCategory {
  const d = desc.toLowerCase();
  if (d.includes("transferencia enviada")) return "transfer_out";
  if (d.includes("transferencia recibida")) return "transfer_in";
  if (d.includes("débito por deuda")) return "debt_debit";
  if (d.includes("devolución") || d.includes("pago cancelado")) return "refund";
  if (d.includes("ingreso de dinero")) return "income";
  if (d.includes("compra")) return "purchase";
  if (d.startsWith("pago ")) return "payment";
  return "other";
}

function categorizeGaliciaDescription(desc: string): TransactionCategory {
  const d = desc.toUpperCase();
  if (d.includes("TRANSFERENCIA A TERCEROS") || d.includes("TRANSF. CTAS PROPIAS"))
    return "transfer_out";
  if (d.includes("TRANSFERENCIA DE TERCEROS") || d.includes("CREDITO TRANSFERENCIA"))
    return "transfer_in";
  if (d.includes("COMPRA DEBITO") || d.includes("COMPRA VENTA")) return "purchase";
  if (d.includes("PAGO TARJETA")) return "payment";
  if (d.includes("PAGO DE SERVICIO") || d.includes("DEBITO DEBIN")) return "service";
  if (d.includes("PERCEPCION RG") || d.includes("ING. BRUTOS")) return "tax";
  if (d.includes("REINTEGRO") || d.includes("DEV.COMPRA") || d.includes("ANULACION")) return "refund";
  if (d.includes("EXTRACCION")) return "extraction";
  return "other";
}

// ---- Person extraction ----

function extractPersonMP(desc: string): string | undefined {
  const transferMatch = desc.match(/Transferencia (?:enviada|recibida)\s+(.+)/i);
  if (transferMatch) return transferMatch[1].trim();

  const pagoMatch = desc.match(/^Pago\s+(?!con QR|cancelado|de servicio)(.+)/i);
  if (pagoMatch) {
    const name = pagoMatch[1].trim();
    if (/^[A-Z\s*]+$/.test(name)) return undefined;
    if (name.split(" ").length >= 2) return name;
  }
  return undefined;
}

function extractPersonGalicia(desc: string): string | undefined {
  const match = desc.match(
    /TRANSFERENCIA (?:A|DE) TERCEROS\s+(.+?)(?:\s+\d{11}|\s+\d{20,}|\s+VARIOS|$)/
  );
  if (match) return titleCase(match[1].trim());
  return undefined;
}

function titleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---- Spending category derivation ----

function deriveSpendingCategory(
  category: TransactionCategory,
  description: string
): SpendingCategory {
  if (category === "transfer_in" || category === "transfer_out") return "transfer";
  if (category === "tax") return "tax";
  return categorizeDescription(description);
}

// ---- Main normalization ----

export function normalizeAll(
  raw: RawData,
  overrides?: OverridesFile
): NormalizedTransaction[] {
  const results: NormalizedTransaction[] = [];

  // Build merchant rule lookup for fast matching
  const merchantRules = overrides?.merchantRules ?? [];

  for (const t of raw.mercadopago.transactions) {
    const date = parseDateDash(t.date);
    const dateStr = toISODate(date);
    const category = categorizeMPDescription(t.description);
    const id = txId("mercadopago", t.date, t.description, parseLocaleNumber(t.amount));

    // Merchant extraction
    const autoMerchantKey = extractMerchantKey(t.description, "mercadopago");
    let merchantName = extractMerchantName(t.description, "mercadopago") ?? undefined;
    let spendingCategory = deriveSpendingCategory(category, t.description);

    // Apply matching merchant rule
    if (autoMerchantKey) {
      const rule = merchantRules.find(
        (r) =>
          r.pattern === autoMerchantKey &&
          (!r.source || r.source === "mercadopago")
      );
      if (rule) {
        merchantName = rule.merchantName;
        spendingCategory = rule.spendingCategory;
      }
    }

    // Apply per-transaction override
    const txOverride = overrides?.transactions[id];
    if (txOverride?.spendingCategory) spendingCategory = txOverride.spendingCategory;
    if (txOverride?.merchantName) merchantName = txOverride.merchantName;

    results.push({
      id,
      date,
      dateStr,
      description: t.description,
      amount: parseLocaleNumber(t.amount),
      balance: parseLocaleNumber(t.balance),
      source: "mercadopago",
      category,
      spendingCategory,
      merchantName,
      period: t.period,
      person: extractPersonMP(t.description),
      referenceId: t.reference_id,
      note: txOverride?.note,
      sharedWith: txOverride?.sharedWith,
      reviewed: txOverride?.reviewed,
    });
  }

  for (const t of raw.galicia.transactions) {
    const date = parseDateSlash(t.date);
    const debit = parseLocaleNumber(t.debit);
    const credit = parseLocaleNumber(t.credit);
    const amount = debit !== 0 ? debit : credit;
    const category = categorizeGaliciaDescription(t.description);
    const dateStr = toISODate(date);
    const id = txId("galicia", t.date, t.description, amount);

    // Merchant extraction
    const autoMerchantKey = extractMerchantKey(t.description, "galicia");
    let merchantName = extractMerchantName(t.description, "galicia") ?? undefined;
    let spendingCategory = deriveSpendingCategory(category, t.description);

    // Apply matching merchant rule
    if (autoMerchantKey) {
      const rule = merchantRules.find(
        (r) =>
          r.pattern === autoMerchantKey &&
          (!r.source || r.source === "galicia")
      );
      if (rule) {
        merchantName = rule.merchantName;
        spendingCategory = rule.spendingCategory;
      }
    }

    // Apply per-transaction override
    const txOverride = overrides?.transactions[id];
    if (txOverride?.spendingCategory) spendingCategory = txOverride.spendingCategory;
    if (txOverride?.merchantName) merchantName = txOverride.merchantName;

    results.push({
      id,
      date,
      dateStr,
      description: t.description,
      amount,
      balance: parseLocaleNumber(t.balance),
      source: "galicia",
      category,
      spendingCategory,
      merchantName,
      person: extractPersonGalicia(t.description),
      note: txOverride?.note,
      sharedWith: txOverride?.sharedWith,
      reviewed: txOverride?.reviewed,
    });
  }

  results.sort((a, b) => b.date.getTime() - a.date.getTime());
  return results;
}
