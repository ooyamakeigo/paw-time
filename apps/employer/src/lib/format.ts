import type { Locale } from "./i18n/messages";

export const TIME_ZONE = "Asia/Tokyo";

const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const dateKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 2026-09-27 in Japan time. */
export function dateKey(value: string | Date): string {
  return dateKeyFormat.format(new Date(value));
}

export function todayKey(now: Date = new Date()): string {
  return dateKey(now);
}

/** Adds days to a YYYY-MM-DD key. */
export function shiftDateKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days));
  return shifted.toISOString().slice(0, 10);
}

/** Builds an ISO timestamp in Japan time from form date and time values. */
export function toJstTimestamp(date: string, time: string): string {
  return `${date}T${time}:00+09:00`;
}

/** 2026-09 in Japan time. */
export function monthKey(value: string | Date): string {
  return dateKey(value).slice(0, 7);
}

export function isMonthKey(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** Adds months to a YYYY-MM key. */
export function shiftMonthKey(key: string, months: number): string {
  const [year, month] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1 + months, 1));
  return shifted.toISOString().slice(0, 7);
}

export function daysInMonth(key: string): number {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, month ?? 1, 0)).getUTCDate();
}

/** The day of the month (1–31) in Japan time. */
export function dayOfMonth(value: string | Date): number {
  return Number(dateKey(value).slice(8, 10));
}

/** The Monday (JST) that starts the week holding the given day key. */
export function weekStartKey(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  const weekday = (date.getUTCDay() + 6) % 7; // Monday = 0
  return shiftDateKey(key, -weekday);
}

export function isDateKey(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export type Formatters = ReturnType<typeof createFormatters>;

/** Date and time display for one language, always in Japan time. */
export function createFormatters(locale: Locale) {
  const tag = locale === "ja" ? "ja-JP" : "en-US";
  const dateFormat = new Intl.DateTimeFormat(
    tag,
    locale === "ja"
      ? { timeZone: TIME_ZONE, month: "long", day: "numeric", weekday: "short" }
      : { timeZone: TIME_ZONE, weekday: "short", month: "short", day: "numeric" },
  );
  const timeFormat = new Intl.DateTimeFormat(tag, {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  /** 9月27日(日) / Sun, Sep 27 */
  const formatDate = (value: string | Date): string => dateFormat.format(new Date(value));
  /** 10:05 */
  const formatTime = (value: string | Date): string => timeFormat.format(new Date(value));
  const formatDateTime = (value: string | Date): string => `${formatDate(value)} ${formatTime(value)}`;

  /** 10:00–15:00, marking the end when a shift runs past midnight. */
  const formatTimeRange = (start: string, end: string): string => {
    const sameDay = dateKey(start) === dateKey(end);
    const endLabel = sameDay
      ? formatTime(end)
      : locale === "ja"
        ? `翌${formatTime(end)}`
        : `${formatTime(end)} (+1)`;
    return `${formatTime(start)}–${endLabel}`;
  };

  const formatElapsed = (value: string, now: Date = new Date()): string => {
    const elapsed = Math.max(0, now.getTime() - Date.parse(value));
    if (elapsed < HOUR) {
      const minutes = Math.max(1, Math.floor(elapsed / MINUTE));
      return locale === "ja" ? `${minutes}分前` : `${minutes} min ago`;
    }
    if (elapsed < DAY) {
      const hours = Math.floor(elapsed / HOUR);
      return locale === "ja" ? `${hours}時間前` : `${hours} h ago`;
    }
    const days = Math.floor(elapsed / DAY);
    return locale === "ja" ? `${days}日前` : `${days} d ago`;
  };

  const formatYen = (value: number): string => `¥${value.toLocaleString(tag)}`;

  /** 2026年9月 / September 2026 */
  const formatMonth = (key: string): string => {
    const [year, month] = key.split("-").map(Number);
    const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 1, 12));
    return new Intl.DateTimeFormat(tag, { timeZone: "UTC", year: "numeric", month: "long" }).format(date);
  };

  /** 5時間30分 / 5h 30m; whole hours drop the minutes. */
  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours === 0) return locale === "ja" ? `${rest}分` : `${rest} min`;
    if (rest === 0) return locale === "ja" ? `${hours}時間` : `${hours}h`;
    return locale === "ja" ? `${hours}時間${rest}分` : `${hours}h ${rest}m`;
  };

  /** 9/28（月） / Mon 9/28: compact, for calendar columns. */
  const formatShortDate = (value: string | Date): string =>
    new Intl.DateTimeFormat(tag, { timeZone: TIME_ZONE, month: "numeric", day: "numeric", weekday: "short" }).format(new Date(value));

  const formatPercent = (ratio: number | null): string => (ratio === null ? "—" : `${Math.round(ratio * 100)}%`);

  return {
    formatDate,
    formatShortDate,
    formatTime,
    formatDateTime,
    formatTimeRange,
    formatElapsed,
    formatYen,
    formatMonth,
    formatMinutes,
    formatPercent,
  };
}
