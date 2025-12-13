/**
 * Shared Utilities Tests
 *
 * Tests for the shared utilities used by catalog ingestion adapters.
 *
 * @vitest-environment node
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sharedModule =
  (await import("../services/catalog-ingest/sources/shared.js")) as any;
const {
  delay,
  withRetry,
  createRateLimiter,
  extractYear,
  normalizeString,
  processBatches,
} = sharedModule;

describe("Shared Utilities", () => {
  describe("delay", () => {
    it("should delay execution by specified milliseconds", async () => {
      const start = Date.now();
      await delay(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some variance
      expect(elapsed).toBeLessThan(100);
    });

    it("should resolve with undefined", async () => {
      const result = await delay(1);
      expect(result).toBeUndefined();
    });
  });

  describe("withRetry", () => {
    it("should return result on first successful attempt", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      const result = await withRetry(fn, { maxRetries: 3 });
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should retry on failure and succeed eventually", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail1"))
        .mockRejectedValueOnce(new Error("fail2"))
        .mockResolvedValue("success");

      const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should throw after max retries exhausted", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("always fails"));

      await expect(withRetry(fn, { maxRetries: 2, baseDelayMs: 10 })).rejects.toThrow(
        "always fails"
      );
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it("should respect shouldRetry callback", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("non-retryable"));

      await expect(
        withRetry(fn, {
          maxRetries: 3,
          baseDelayMs: 10,
          shouldRetry: () => false,
        })
      ).rejects.toThrow("non-retryable");
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe("createRateLimiter", () => {
    it("should allow requests within limit", async () => {
      const limiter = createRateLimiter(5, 1000);
      const start = Date.now();

      for (let i = 0; i < 5; i++) {
        await limiter.check();
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100); // Should be almost instant
    });

    it("should reset correctly", async () => {
      const limiter = createRateLimiter(2, 10000);

      await limiter.check();
      await limiter.check();
      limiter.reset();
      await limiter.check(); // Should not wait after reset

      // If we got here without hanging, reset worked
      expect(true).toBe(true);
    });
  });

  describe("extractYear", () => {
    it("should extract year from ISO date string", () => {
      expect(extractYear("2023-06-15")).toBe(2023);
      expect(extractYear("1999-12-31T23:59:59Z")).toBe(1999);
    });

    it("should extract year from various string formats", () => {
      expect(extractYear("Jul 9, 2013")).toBe(2013);
      expect(extractYear("Released in 2020")).toBe(2020);
      expect(extractYear("Coming 2024")).toBe(2024);
    });

    it("should handle Date objects", () => {
      expect(extractYear(new Date("2023-06-15"))).toBe(2023);
    });

    it("should return null for invalid dates", () => {
      expect(extractYear(null)).toBeNull();
      expect(extractYear(undefined)).toBeNull();
      expect(extractYear("")).toBeNull();
      expect(extractYear("no year here")).toBeNull();
      expect(extractYear("TBD")).toBeNull();
    });

    it("should handle edge cases", () => {
      // Years 1900-2099 match the regex pattern (19xx or 20xx)
      expect(extractYear("1850")).toBeNull(); // Before 19xx, no 4-digit 19xx/20xx year
      expect(extractYear("1900")).toBe(1900);
      expect(extractYear("2099")).toBe(2099);
      // Note: "2100" is parsed as a date and falls back to Dec 31 2099 in most JS engines
      // which is in range, so it may return 2099 rather than null
    });
  });

  describe("normalizeString", () => {
    it("should lowercase and remove special characters", () => {
      expect(normalizeString("The Witcher 3: Wild Hunt")).toBe("the witcher 3 wild hunt");
      expect(normalizeString("Doom (2016)")).toBe("doom 2016");
    });

    it("should handle edge cases", () => {
      expect(normalizeString("")).toBe("");
      expect(normalizeString(null)).toBe("");
      expect(normalizeString(undefined)).toBe("");
      expect(normalizeString(123)).toBe("123");
    });

    it("should collapse multiple spaces", () => {
      expect(normalizeString("Game    Title")).toBe("game title");
      expect(normalizeString("  Spaces  ")).toBe("spaces");
    });
  });

  describe("processBatches", () => {
    it("should process items in batches", async () => {
      const items = [1, 2, 3, 4, 5];
      const processor = vi.fn().mockImplementation((n) => n * 2);

      const results = await processBatches(items, processor, { batchSize: 2 });

      expect(results).toEqual([2, 4, 6, 8, 10]);
      expect(processor).toHaveBeenCalledTimes(5);
    });

    it("should handle errors gracefully", async () => {
      const items = [1, 2, 3];
      const processor = vi
        .fn()
        .mockResolvedValueOnce(1)
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValueOnce(3);

      const results = await processBatches(items, processor, { batchSize: 3 });

      expect(results).toEqual([1, null, 3]);
    });

    it("should call onProgress callback", async () => {
      const items = [1, 2, 3, 4];
      const processor = vi.fn().mockImplementation((n) => n);
      const onProgress = vi.fn();

      await processBatches(items, processor, { batchSize: 2, onProgress });

      expect(onProgress).toHaveBeenCalledWith(2, 4);
      expect(onProgress).toHaveBeenCalledWith(4, 4);
    });

    it("should handle empty input", async () => {
      const results = await processBatches([], vi.fn());
      expect(results).toEqual([]);
    });
  });
});
