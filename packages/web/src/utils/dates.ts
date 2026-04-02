import {
  type CalendarDate,
  type DateValue,
  today,
  getLocalTimeZone,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfYear,
  endOfYear,
  parseDate,
} from "@internationalized/date";

/** Convert ISO date string (YYYY-MM-DD) to CalendarDate. */
export function toCalendarDate(iso: string): CalendarDate {
  return parseDate(iso);
}

/** Convert CalendarDate to ISO date string (YYYY-MM-DD). */
export function toISODate(date: DateValue): string {
  return date.toString();
}

export interface DatePreset {
  key: string;
  label: string;
  /** Returns start/end range, or null for "all time" (no filter). */
  range: () => { start: CalendarDate; end: CalendarDate } | null;
}

/** Preset date ranges for the picker. "This month" is the default. */
export const DATE_PRESETS: DatePreset[] = [
  {
    key: "today",
    label: "Today",
    range: () => {
      const d = today(getLocalTimeZone());
      return { start: d, end: d };
    },
  },
  {
    key: "week",
    label: "This week",
    range: () => {
      const d = today(getLocalTimeZone());
      const locale = navigator.language || "en-US";
      return { start: startOfWeek(d, locale), end: endOfWeek(d, locale) };
    },
  },
  {
    key: "month",
    label: "This month",
    range: () => {
      const d = today(getLocalTimeZone());
      return { start: startOfMonth(d), end: endOfMonth(d) };
    },
  },
  {
    key: "3months",
    label: "Last 3 months",
    range: () => {
      const d = today(getLocalTimeZone());
      return { start: startOfMonth(d.subtract({ months: 2 })), end: endOfMonth(d) };
    },
  },
  {
    key: "year",
    label: "This year",
    range: () => {
      const d = today(getLocalTimeZone());
      return { start: startOfYear(d), end: endOfYear(d) };
    },
  },
  {
    key: "all",
    label: "All time",
    range: () => null,
  },
];

/** Format a date range as a readable label. Matches preset name if applicable, else "Mar 1 – Mar 27". */
export function formatRangeLabel(dateFrom?: string, dateTo?: string): string {
  if (!dateFrom && !dateTo) return "All time";

  // Check if it matches a preset
  for (const preset of DATE_PRESETS) {
    const range = preset.range();
    if (!range && !dateFrom && !dateTo) return preset.label;
    if (range && dateFrom === toISODate(range.start) && dateTo === toISODate(range.end)) {
      return preset.label;
    }
  }

  // Custom range — format as "Mar 1 – Mar 27" (add year if not current)
  const currentYear = new Date().getFullYear();
  const fmt = (iso: string) => {
    const parts = iso.split("-");
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    if (y !== currentYear) opts.year = "numeric";
    return new Date(y, m - 1, d).toLocaleDateString("en-US", opts);
  };

  if (dateFrom && dateTo) return `${fmt(dateFrom)} – ${fmt(dateTo)}`;
  if (dateFrom) return `From ${fmt(dateFrom)}`;
  return `Until ${fmt(dateTo!)}`;
}

/** Compute the previous period of the same length, ending the day before the current starts. */
export function getPreviousPeriod(dateFrom: string, dateTo: string): { dateFrom: string; dateTo: string } {
  const from = new Date(dateFrom + "T12:00:00");
  const to = new Date(dateTo + "T12:00:00");
  const days = Math.round((to.getTime() - from.getTime()) / 86400000);
  const prevTo = new Date(from.getTime() - 86400000); // day before current start
  const prevFrom = new Date(prevTo.getTime() - days * 86400000);
  return {
    dateFrom: prevFrom.toISOString().slice(0, 10),
    dateTo: prevTo.toISOString().slice(0, 10),
  };
}

/** Returns "This month" range as ISO strings. Default for records page. */
export function getDefaultRange(): { dateFrom: string; dateTo: string } {
  const range = DATE_PRESETS.find((p) => p.key === "month")!.range()!;
  return { dateFrom: toISODate(range.start), dateTo: toISODate(range.end) };
}
