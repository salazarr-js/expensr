import type {
  RawData,
  NormalizedTransaction,
  TransactionCategory,
} from "../types";
import { parseLocaleNumber, parseDateDash, parseDateSlash, toISODate } from "./parse";

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

function extractPersonMP(desc: string): string | undefined {
  // "Transferencia enviada Federico Romano" → "Federico Romano"
  // "Transferencia recibida Amir Mukahel" → "Amir Mukahel"
  // "Pago Eduardo Alfonso Ferrer Boada" → "Eduardo Alfonso Ferrer Boada"
  // "Pago con QR Guerrin" → "Guerrin" (merchant, not a person)
  const transferMatch = desc.match(/Transferencia (?:enviada|recibida)\s+(.+)/i);
  if (transferMatch) return transferMatch[1].trim();

  const pagoMatch = desc.match(/^Pago\s+(?!con QR|cancelado|de servicio)(.+)/i);
  if (pagoMatch) {
    const name = pagoMatch[1].trim();
    // Skip known merchants (all caps or common patterns)
    if (/^[A-Z\s*]+$/.test(name)) return undefined; // "EBANX S.A.", "SUBE"
    // If it looks like a person name (mixed case, multiple words)
    if (name.split(" ").length >= 2) return name;
  }
  return undefined;
}

function extractPersonGalicia(desc: string): string | undefined {
  // "TRANSFERENCIA A TERCEROS Roberto Carlos Maciel 20280305902..."
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

export function normalizeAll(raw: RawData): NormalizedTransaction[] {
  const results: NormalizedTransaction[] = [];

  for (let i = 0; i < raw.mercadopago.transactions.length; i++) {
    const t = raw.mercadopago.transactions[i];
    const date = parseDateDash(t.date);
    results.push({
      id: `mp-${i}`,
      date,
      dateStr: toISODate(date),
      description: t.description,
      amount: parseLocaleNumber(t.amount),
      balance: parseLocaleNumber(t.balance),
      source: "mercadopago",
      category: categorizeMPDescription(t.description),
      period: t.period,
      person: extractPersonMP(t.description),
      referenceId: t.reference_id,
    });
  }

  for (let i = 0; i < raw.galicia.transactions.length; i++) {
    const t = raw.galicia.transactions[i];
    const date = parseDateSlash(t.date);
    const debit = parseLocaleNumber(t.debit);
    const credit = parseLocaleNumber(t.credit);
    const amount = debit !== 0 ? debit : credit;
    results.push({
      id: `gal-${i}`,
      date,
      dateStr: toISODate(date),
      description: t.description,
      amount,
      balance: parseLocaleNumber(t.balance),
      source: "galicia",
      category: categorizeGaliciaDescription(t.description),
      person: extractPersonGalicia(t.description),
    });
  }

  results.sort((a, b) => b.date.getTime() - a.date.getTime());
  return results;
}
