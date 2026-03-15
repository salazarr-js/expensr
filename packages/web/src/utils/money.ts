/** Locale-aware number formatter with 2 decimal places. Shared by all money helpers. */
const formatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Splits a formatted amount into integer and decimal parts for styled rendering. */
export function formatMoneyParts(amount: number): { integer: string; decimal: string } {
  const parts = formatter.formatToParts(amount);
  const decIdx = parts.findIndex((p) => p.type === "decimal");
  const integer = parts.slice(0, decIdx).map((p) => p.value).join("");
  const decimal = parts.slice(decIdx).map((p) => p.value).join("");
  return { integer, decimal };
}
