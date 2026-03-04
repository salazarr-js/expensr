/**
 * Extract clean merchant identifiers and display names from cryptic bank descriptions.
 */

/** Stable key for matching merchant rules — lowercase, stripped of noise */
export function extractMerchantKey(
  desc: string,
  source: "mercadopago" | "galicia"
): string | null {
  if (source === "galicia") return extractGaliciaKey(desc);
  return extractMPKey(desc);
}

/** Human-readable merchant name */
export function extractMerchantName(
  desc: string,
  source: "mercadopago" | "galicia"
): string | null {
  if (source === "galicia") return extractGaliciaName(desc);
  return extractMPName(desc);
}

// ---- Galicia ----

function extractGaliciaKey(desc: string): string | null {
  const d = desc.toUpperCase();

  // COMPRA DEBITO MERPAGO*SBUXESPEJO 4425XXX... → "merpago*sbuxespejo"
  // COMPRA DEBITO RAPPI 4425XXX... → "rappi"
  // COMPRA DEBITO PAYU*AR*UBER 4425XXX... → "payu*ar*uber"
  // COMPRA DEBITO UBER SHOPPER STATEMENT 4425XXX... → "uber shopper statement"
  // COMPRA DEBITO DLO*Rappi 4425XXX... → "dlo*rappi"
  const compraMatch = d.match(
    /COMPRA (?:DEBITO|VENTA)\s+(.+?)\s+(?:\d{4}X|$)/
  );
  if (compraMatch) return compraMatch[1].toLowerCase().trim();

  // Compra venta de dolares...
  if (d.includes("COMPRA VENTA DE DOLARES")) return "compra_venta_usd";

  // DEBITO DEBIN RECURRENTE ... CUIT ... → "debin:CUIT"
  const debinMatch = d.match(
    /DEBITO DEBIN RECURRENTE\s+\S+\s+(\d{11})/
  );
  if (debinMatch) return `debin:${debinMatch[1]}`;

  // PAGO DE SERVICIOS EDESUR 000... → "edesur"
  const servicioMatch = d.match(/PAGO DE SERVICIOS?\s+(\S+)/);
  if (servicioMatch) return servicioMatch[1].toLowerCase();

  // PAGO TARJETA VISA OPERACION... → "pago_tarjeta_visa"
  if (d.includes("PAGO TARJETA")) return "pago_tarjeta";

  // REINTEGRO PROMOCION GALICIA Subte → "reintegro:subte"
  const reintegroMatch = d.match(/REINTEGRO PROMOCION GALICIA\s+(.+)/i);
  if (reintegroMatch) return `reintegro:${reintegroMatch[1].toLowerCase().trim()}`;

  // PERCEPCION / ING. BRUTOS → taxes, not merchants
  if (d.includes("PERCEPCION") || d.includes("ING. BRUTOS")) return null;

  // ANULACION / DEV.COMPRA → refunds
  if (d.includes("ANULACION") || d.includes("DEV.COMPRA")) return null;

  // Transfers have person extraction, not merchant
  if (d.includes("TRANSFERENCIA") || d.includes("TRANSF. CTAS")) return null;

  return null;
}

function extractGaliciaName(desc: string): string | null {
  const key = extractGaliciaKey(desc);
  if (!key) return null;

  // Clean up MERPAGO* prefix
  if (key.startsWith("merpago*")) {
    return titleCase(key.slice(8));
  }
  // PAYU*AR*UBER → Uber
  if (key.startsWith("payu*ar*")) {
    return titleCase(key.slice(8));
  }
  // DLO* prefix
  if (key.startsWith("dlo*")) {
    return titleCase(key.slice(4));
  }
  // DEBIN subscriptions — show CUIT (can be overridden)
  if (key.startsWith("debin:")) {
    return `Subscription (DEBIN ${key.slice(6)})`;
  }
  if (key.startsWith("reintegro:")) {
    return `Reintegro ${titleCase(key.slice(10))}`;
  }
  if (key === "compra_venta_usd") return "Compra/Venta USD";
  if (key === "pago_tarjeta") return "Pago Tarjeta";

  return titleCase(key);
}

// ---- MercadoPago ----

function extractMPKey(desc: string): string | null {
  // Transfers → person, not merchant
  if (/transferencia/i.test(desc)) return null;
  // Débito por deuda → not a merchant
  if (/débito por deuda/i.test(desc)) return null;
  // Ingreso de dinero → not a merchant
  if (/ingreso de dinero/i.test(desc)) return null;
  // Devolución → refund
  if (/devolución/i.test(desc)) return null;
  // Pago cancelado → refund
  if (/pago cancelado/i.test(desc)) return null;

  // "Pago con QR Guerrin" → "guerrin"
  const qrMatch = desc.match(/Pago con QR\s+(.+)/i);
  if (qrMatch) return qrMatch[1].toLowerCase().trim();

  // "Pago EBANX S.A." → "ebanx s.a."
  // "Pago Carrefour" → "carrefour"
  // "Pago Dlo*didi" → "dlo*didi"
  const pagoMatch = desc.match(/^Pago\s+(.+)/i);
  if (pagoMatch) return pagoMatch[1].toLowerCase().trim();

  // "Compra ..." (if any)
  const compraMatch = desc.match(/^Compra\s+(.+)/i);
  if (compraMatch) return compraMatch[1].toLowerCase().trim();

  return null;
}

function extractMPName(desc: string): string | null {
  const key = extractMPKey(desc);
  if (!key) return null;

  // DLO* prefix
  if (key.startsWith("dlo*")) return titleCase(key.slice(4));

  return titleCase(key);
}

// ---- Helpers ----

function titleCase(str: string): string {
  return str
    .replace(/[_*]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s+/g, " ")
    .trim();
}
