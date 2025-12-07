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
