// Types
export type Currency = "ARS" | "USD" | "CLP";

// Utils
export function formatCurrency(amount: number, currency: Currency): string {
  const locale = currency === "ARS" ? "es-AR" : currency === "CLP" ? "es-CL" : "en-US";
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
}
