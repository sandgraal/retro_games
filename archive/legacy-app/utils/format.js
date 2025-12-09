/**
 * Formatting helpers extracted from the legacy app.js.
 * These functions provide small, dependency-free utilities the new UI relies on.
 */

const currencyFormatters = new Map();

function getCurrencyFormatter(minFractionDigits, maxFractionDigits) {
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
  return currencyFormatters.get(key);
}

/**
 * Format a numeric value as USD currency.
 * Supports values expressed in cents when `fromCents` is true.
 * @param {number|string|null|undefined} value
 * @param {{ fromCents?: boolean, precision?: number }} [options]
 * @returns {string}
 */
export function formatCurrency(value, { fromCents = false, precision } = {}) {
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

  const fixed = amount.toFixed(fractionDigits);
  return `$${fixed}`;
}

/**
 * Format a number with thousands separators.
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export function formatNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  if (typeof Intl !== "undefined") {
    return new Intl.NumberFormat("en-US").format(numeric);
  }
  return Math.round(numeric).toString();
}

/**
 * Format a rating value to one decimal place.
 * Returns "N/A" when the value is missing or invalid.
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export function formatRating(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "N/A";
  return numeric.toFixed(1);
}

/**
 * Format a percentage value for display.
 * Handles edge cases like small values (<1%) and invalid inputs.
 * @param {number|null|undefined} value - The percentage value
 * @param {number} [count=0] - Optional count for validation
 * @returns {string}
 */
export function formatPercent(value, count = 0) {
  if (!count || !Number.isFinite(value) || value <= 0) return "0%";
  if (value < 1) return "<1%";
  if (value < 10) {
    return `${value.toFixed(1).replace(/\.0$/, "")}%`;
  }
  return `${Math.round(value)}%`;
}

/**
 * Convert a field name to a human-readable label.
 * Handles camelCase, snake_case, and kebab-case.
 * @param {string|null|undefined} fieldName
 * @returns {string}
 */
export function formatFieldLabel(fieldName) {
  if (!fieldName) return "";
  return fieldName
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Produce a short relative time label from a timestamp.
 * @param {number|null|undefined} timestamp - Unix timestamp in milliseconds
 * @returns {string}
 */
export function timeAgo(timestamp) {
  if (!timestamp) return "";
  const diff = Date.now() - timestamp;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.max(1, Math.round(diff / 60000))}m`;
  if (diff < 86400000) return `${Math.max(1, Math.round(diff / 3600000))}h`;
  return `${Math.max(1, Math.round(diff / 86400000))}d`;
}

/**
 * Format a date value to an absolute date string (e.g., "Dec 7, 2025").
 * @param {string|number|Date|null|undefined} value
 * @returns {string}
 */
export function formatAbsoluteDate(value) {
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
 * Produce a relative time label from a date-like input.
 * @param {string|number|Date|null|undefined} value
 * @returns {string}
 */
export function formatRelativeDate(value) {
  if (!value) return "";
  const timestamp =
    value instanceof Date
      ? value.getTime()
      : typeof value === "number"
        ? value
        : Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  return timeAgo(timestamp);
}
