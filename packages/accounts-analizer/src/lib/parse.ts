// Parse Argentine locale number: "2.258.294,60" → 2258294.60
// Handles: "-3.647,72", "0,00", "149319,76" (no dots)
export function parseLocaleNumber(str: string | null | undefined): number {
  if (!str) return 0;
  const s = str.trim();
  if (s === "0,00" || s === "0") return 0;
  const cleaned = s.replace(/\./g, "").replace(",", ".");
  return Number(cleaned) || 0;
}

// Parse DD-MM-YYYY (MercadoPago format)
export function parseDateDash(str: string): Date {
  const [d, m, y] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Parse DD/MM/YYYY (Galicia format)
export function parseDateSlash(str: string): Date {
  const [d, m, y] = str.split("/").map(Number);
  return new Date(y, m - 1, d);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function toMonthKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
}

export function toMonthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
