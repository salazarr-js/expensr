/** */
export interface AppColor {
  name: string;
  100: string;
  200: string;
  500: string;
}

/** */
export const APP_COLORS: AppColor[] = [
  { name: "Red", 100: "#fee2e2", 200: "#fecaca", 500: "#ef4444" },
  { name: "Orange", 100: "#ffedd5", 200: "#fed7aa", 500: "#f97316" },
  { name: "Amber", 100: "#fef3c7", 200: "#fde68a", 500: "#f59e0b" },
  { name: "Yellow", 100: "#fef9c3", 200: "#fef08a", 500: "#eab308" },
  { name: "Lime", 100: "#ecfccb", 200: "#d9f99d", 500: "#84cc16" },
  { name: "Green", 100: "#dcfce7", 200: "#bbf7d0", 500: "#22c55e" },
  { name: "Emerald", 100: "#d1fae5", 200: "#a7f3d0", 500: "#10b981" },
  { name: "Teal", 100: "#ccfbf1", 200: "#99f6e4", 500: "#14b8a6" },
  { name: "Cyan", 100: "#cffafe", 200: "#a5f3fc", 500: "#06b6d4" },
  { name: "Sky", 100: "#e0f2fe", 200: "#bae6fd", 500: "#0ea5e9" },
  { name: "Blue", 100: "#dbeafe", 200: "#bfdbfe", 500: "#3b82f6" },
  { name: "Indigo", 100: "#e0e7ff", 200: "#c7d2fe", 500: "#6366f1" },
  { name: "Violet", 100: "#ede9fe", 200: "#ddd6fe", 500: "#8b5cf6" },
  { name: "Purple", 100: "#f3e8ff", 200: "#e9d5ff", 500: "#a855f7" },
  { name: "Fuchsia", 100: "#fae8ff", 200: "#f5d0fe", 500: "#d946ef" },
  { name: "Pink", 100: "#fce7f3", 200: "#fbcfe8", 500: "#ec4899" },
  { name: "Rose", 100: "#ffe4e6", 200: "#fecdd3", 500: "#f43f5e" },
  { name: "Stone", 100: "#f5f5f4", 200: "#e7e5e4", 500: "#78716c" },
  { name: "Slate", 100: "#f1f5f9", 200: "#e2e8f0", 500: "#64748b" },
];

/** */
const colorMap = new Map(APP_COLORS.map((c) => [c.name, c]));

/** Looks up an app color palette by name. Returns `null` if not found. */
export function getColor(name: string | null): AppColor | null {
  if (!name) return null;
  return colorMap.get(name) ?? null;
}
