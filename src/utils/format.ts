/**
 * Formatting Utilities
 * Pure functions for formatting values for display
 */

// Currency formatter cache
const currencyFormatters = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(
  minFractionDigits: number,
  maxFractionDigits: number
): Intl.NumberFormat | null {
  const key = `${minFractionDigits}-${maxFractionDigits}`;
  if (!currencyFormatters.has(key)) {
    currencyFormatters.set(
      key,
      typeof Intl !== "undefined"
        ? new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: minFractionDigits,
            maximumFractionDigits: maxFractionDigits,
          })
        : null
    );
  }
  return currencyFormatters.get(key) ?? null;
}

export interface CurrencyOptions {
  fromCents?: boolean;
  precision?: number;
}

/**
 * Format a numeric value as USD currency
 */
export function formatCurrency(
  value: number | string | null | undefined,
  options: CurrencyOptions = {}
): string {
  const { fromCents = false, precision } = options;

  // Handle null/undefined explicitly
  if (value === null || value === undefined) return "$0";

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "$0";

  const amount = fromCents ? numeric / 100 : numeric;
  const fractionDigits =
    typeof precision === "number"
      ? precision
      : fromCents
        ? 0
        : Math.abs(amount) < 1000
          ? 2
          : 0;

  const formatter = getCurrencyFormatter(fractionDigits, fractionDigits);
  if (formatter) return formatter.format(amount);

  return `$${amount.toFixed(fractionDigits)}`;
}

/**
 * Format a number with thousands separators
 */
export function formatNumber(value: number | string | null | undefined): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  if (typeof Intl !== "undefined") {
    return new Intl.NumberFormat("en-US").format(numeric);
  }
  return Math.round(numeric).toString();
}

/**
 * Format a rating value to one decimal place
 */
export function formatRating(value: number | string | null | undefined): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "N/A";
  return numeric.toFixed(1);
}

/**
 * Format a percentage value for display
 */
export function formatPercent(
  value: number | null | undefined,
  count: number = 0
): string {
  if (!count || !Number.isFinite(value) || (value ?? 0) <= 0) return "0%";
  const v = value as number;
  if (v < 1) return "<1%";
  if (v < 10) {
    return `${v.toFixed(1).replace(/\.0$/, "")}%`;
  }
  return `${Math.round(v)}%`;
}

/**
 * Convert a field name to a human-readable label
 */
export function formatFieldLabel(fieldName: string | null | undefined): string {
  if (!fieldName) return "";
  return fieldName
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Produce a short relative time label from a timestamp
 */
export function timeAgo(timestamp: number | null | undefined): string {
  if (!timestamp) return "";
  const diff = Date.now() - timestamp;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.max(1, Math.round(diff / 60000))}m`;
  if (diff < 86400000) return `${Math.max(1, Math.round(diff / 3600000))}h`;
  return `${Math.max(1, Math.round(diff / 86400000))}d`;
}

/**
 * Format a date value to an absolute date string
 */
export function formatAbsoluteDate(
  value: string | number | Date | null | undefined
): string {
  if (!value) return "";
  const date =
    value instanceof Date
      ? value
      : typeof value === "number"
        ? new Date(value)
        : new Date(String(value));
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

/**
 * Produce a relative time label from a date-like input
 */
export function formatRelativeDate(
  value: string | number | Date | null | undefined
): string {
  if (!value) return "";
  const timestamp =
    value instanceof Date
      ? value.getTime()
      : typeof value === "number"
        ? value
        : Date.parse(value as string);
  if (!Number.isFinite(timestamp)) return "";
  return timeAgo(timestamp);
}

/**
 * Format bytes as human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format a duration in milliseconds to human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000)
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}
