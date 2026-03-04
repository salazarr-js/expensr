import type { SpendingCategory } from "../types";

// keyword → category, checked against description (case-insensitive)
const RULES: [RegExp, SpendingCategory][] = [
  [/salario|sueldo/i, "salary"],
  [/uber|didi|cabify|emova|subte/i, "transport"],
  [/rappi|posho|meraki|pizza|empanada|sushi|pollo|chicken|restaur|café|sbux|starbucks|burger|mcdon|guerrin|gurrufio/i, "food"],
  [/carrefour|verdura|chino|autoservicio|supermercado|oriana|xiaolan/i, "groceries"],
  [/expensa|consorcio|alquiler/i, "housing"],
  [/edesur|edenor|metrogas|aysa|movistar|claro|telecom/i, "utilities"],
  [/padel|pasco tenis|muniz|muñiz|araoz|futbol|gym|megatlon|franco padel/i, "sports"],
  [/osde|farmacia|medic|hospital|psicol|cruzverde/i, "health"],
  [/mercado libre|merpago|shein|amazon|tienda/i, "shopping"],
  [/melida|gustavo.*salazar|del valle/i, "family"],
  [/netflix|spotify|youtube|disney|hbo|google one|adobe|linkedin|capcut/i, "subscription"],
  [/percepcion|iibb|afip|impuesto|ing\. brutos/i, "tax"],
];

export function categorizeDescription(desc: string): SpendingCategory {
  for (const [pattern, cat] of RULES) {
    if (pattern.test(desc)) return cat;
  }
  return "other";
}

export const CATEGORY_LABELS: Record<SpendingCategory, string> = {
  salary: "Salary",
  transport: "Transport",
  food: "Food & Dining",
  groceries: "Groceries",
  housing: "Housing",
  utilities: "Utilities",
  sports: "Sports",
  health: "Health",
  shopping: "Shopping",
  family: "Family",
  entertainment: "Entertainment",
  subscription: "Subscriptions",
  tax: "Taxes & Fees",
  transfer: "Transfers",
  other: "Other",
};

export const CATEGORY_COLORS: Record<SpendingCategory, string> = {
  salary: "bg-green-100 text-green-700",
  transport: "bg-sky-100 text-sky-700",
  food: "bg-orange-100 text-orange-700",
  groceries: "bg-lime-100 text-lime-700",
  housing: "bg-indigo-100 text-indigo-700",
  utilities: "bg-yellow-100 text-yellow-700",
  sports: "bg-teal-100 text-teal-700",
  health: "bg-pink-100 text-pink-700",
  shopping: "bg-purple-100 text-purple-700",
  family: "bg-rose-100 text-rose-700",
  entertainment: "bg-fuchsia-100 text-fuchsia-700",
  subscription: "bg-violet-100 text-violet-700",
  tax: "bg-red-100 text-red-700",
  transfer: "bg-blue-100 text-blue-700",
  other: "bg-gray-100 text-gray-600",
};
