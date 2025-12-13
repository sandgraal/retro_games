/**
 * Shared Utilities for Source Adapters
 * Common functions used across all catalog ingestion adapters
 */

/**
 * Delay execution for rate limiting
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {object} options - Retry options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.baseDelayMs - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelayMs - Maximum delay in ms (default: 30000)
 * @param {Function} options.shouldRetry - Function to determine if error is retryable
 * @returns {Promise<any>} Result of the function
 */
export async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    shouldRetry = () => true,
  } = options;

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }
      const delayMs = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      console.log(`[retry] Attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`);
      await delay(delayMs);
    }
  }
  throw lastError;
}

/**
 * Create a rate limiter
 * @param {number} maxRequests - Maximum requests per window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {object} Rate limiter with check() method
 */
export function createRateLimiter(maxRequests, windowMs) {
  let requestCount = 0;
  let windowStart = Date.now();

  return {
    /**
     * Check rate limit and wait if necessary
     * @returns {Promise<void>}
     */
    async check() {
      const now = Date.now();
      if (now - windowStart > windowMs) {
        windowStart = now;
        requestCount = 0;
      }

      if (requestCount >= maxRequests) {
        const waitTime = windowMs - (now - windowStart);
        console.log(
          `[rate-limit] Limit reached, waiting ${Math.ceil(waitTime / 1000)}s...`
        );
        await delay(waitTime + 100);
        windowStart = Date.now();
        requestCount = 0;
      }

      requestCount++;
    },

    /**
     * Reset the rate limiter
     */
    reset() {
      requestCount = 0;
      windowStart = Date.now();
    },
  };
}

/**
 * Safe JSON fetch with error handling
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @param {string} options.userAgent - User-Agent header (default: Dragons-Hoard-Atlas/2.1.0)
 * @param {object} options.headers - Additional headers
 * @returns {Promise<object|null>} JSON response or null on error
 */
export async function safeFetchJson(url, options = {}) {
  const {
    userAgent = "Dragons-Hoard-Atlas/2.1.0",
    headers = {},
    ...fetchOptions
  } = options;

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        "User-Agent": userAgent,
        Accept: "application/json",
        ...headers,
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw {
          status: 429,
          retryAfter: parseInt(response.headers.get("Retry-After") || "60", 10),
        };
      }
      return null;
    }

    return await response.json();
  } catch (error) {
    if (error.status === 429) throw error;
    console.error(`[fetch] Error fetching ${url}:`, error.message);
    return null;
  }
}

/**
 * Extract year from various date string formats
 * @param {string|Date|null} dateValue - Date string or Date object
 * @returns {number|null} Year or null if unable to parse
 */
export function extractYear(dateValue) {
  if (!dateValue) return null;

  // If it's a Date object
  if (dateValue instanceof Date) {
    const year = dateValue.getFullYear();
    return isNaN(year) || year < 1900 || year > 2099 ? null : year;
  }

  // Try to find a 4-digit year in the string (1900-2099)
  const match = String(dateValue).match(/\b(19|20)\d{2}\b/);
  if (match) {
    return parseInt(match[0], 10);
  }

  // Try to parse as ISO date
  try {
    const date = new Date(dateValue);
    const year = date.getFullYear();
    if (!isNaN(date.getTime()) && year >= 1900 && year <= 2099) {
      return year;
    }
  } catch {
    // Ignore parse errors
  }

  return null;
}

/**
 * Normalize a string for comparison (lowercase, alphanumeric only)
 * @param {string} value - String to normalize
 * @returns {string} Normalized string
 */
export function normalizeString(value) {
  return (value || "")
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Batch array processing with progress callback
 * @param {Array} items - Items to process
 * @param {Function} processFn - Async function to process each item
 * @param {object} options - Options
 * @param {number} options.batchSize - Items per batch (default: 10)
 * @param {number} options.delayBetweenBatches - Delay between batches in ms (default: 0)
 * @param {Function} options.onProgress - Progress callback (processed, total)
 * @returns {Promise<Array>} Results array (may contain nulls for failed items)
 */
export async function processBatches(items, processFn, options = {}) {
  const { batchSize = 10, delayBetweenBatches = 0, onProgress } = options;

  const results = [];
  let processed = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        try {
          return await processFn(item);
        } catch (error) {
          console.error(`[batch] Error processing item:`, error.message);
          return null;
        }
      })
    );

    results.push(...batchResults);
    processed += batch.length;

    if (onProgress) {
      onProgress(processed, items.length);
    }

    if (delayBetweenBatches > 0 && i + batchSize < items.length) {
      await delay(delayBetweenBatches);
    }
  }

  return results;
}

export default {
  delay,
  withRetry,
  createRateLimiter,
  safeFetchJson,
  extractYear,
  normalizeString,
  processBatches,
};
