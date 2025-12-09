/**
 * Core Module Tests
 * Tests for signals, types, and key utilities
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createSignal,
  computed,
  effect,
  batch,
  generateGameKey,
  parseGameKey,
  withGameKey,
  withGameKeys,
  keyMatchesGame,
  createGameLookup,
} from "../src/core";

describe("signals", () => {
  describe("createSignal", () => {
    it("should create a signal with initial value", () => {
      const signal = createSignal(42);
      expect(signal.get()).toBe(42);
    });

    it("should update value with set", () => {
      const signal = createSignal(0);
      signal.set(10);
      expect(signal.get()).toBe(10);
    });

    it("should support functional updates", () => {
      const signal = createSignal(5);
      signal.set((prev) => prev * 2);
      expect(signal.get()).toBe(10);
    });

    it("should notify subscribers on change", async () => {
      const signal = createSignal(0);
      const subscriber = vi.fn();
      signal.subscribe(subscriber);

      signal.set(1);

      // Wait for microtask
      await new Promise((resolve) => queueMicrotask(resolve));

      expect(subscriber).toHaveBeenCalledWith(1);
    });

    it("should not notify if value unchanged", async () => {
      const signal = createSignal(5);
      const subscriber = vi.fn();
      signal.subscribe(subscriber);

      signal.set(5);

      await new Promise((resolve) => queueMicrotask(resolve));

      expect(subscriber).not.toHaveBeenCalled();
    });

    it("should support unsubscribe", async () => {
      const signal = createSignal(0);
      const subscriber = vi.fn();
      const unsubscribe = signal.subscribe(subscriber);

      unsubscribe();
      signal.set(1);

      await new Promise((resolve) => queueMicrotask(resolve));

      expect(subscriber).not.toHaveBeenCalled();
    });

    it("peek should return value without tracking", () => {
      const signal = createSignal(42);
      expect(signal.peek()).toBe(42);
    });
  });

  describe("computed", () => {
    it("should compute derived value", () => {
      const count = createSignal(5);
      const doubled = computed(() => count.get() * 2);

      expect(doubled.get()).toBe(10);
    });

    it("should update when dependencies change", async () => {
      const count = createSignal(5);
      const doubled = computed(() => count.get() * 2);

      count.set(10);

      // Wait for recomputation
      await new Promise((resolve) => queueMicrotask(resolve));

      expect(doubled.get()).toBe(20);
    });

    it("should support multiple dependencies", () => {
      const a = createSignal(2);
      const b = createSignal(3);
      const sum = computed(() => a.get() + b.get());

      expect(sum.get()).toBe(5);
    });
  });

  describe("effect", () => {
    it("should run immediately", () => {
      const fn = vi.fn();
      effect(fn);
      expect(fn).toHaveBeenCalled();
    });

    it("should cleanup on unsubscribe", () => {
      const cleanup = vi.fn();
      const dispose = effect(() => cleanup);

      dispose();

      expect(cleanup).toHaveBeenCalled();
    });
  });

  describe("batch", () => {
    it("should defer notifications until batch completes", () => {
      const a = createSignal(0);
      const b = createSignal(0);
      const subscriber = vi.fn();

      a.subscribe(subscriber);
      b.subscribe(subscriber);

      batch(() => {
        a.set(1);
        b.set(2);
      });

      // Subscriber should be called after batch completes, not during
      expect(subscriber).toHaveBeenCalledTimes(2);
    });

    it("should allow nested batches", () => {
      const signal = createSignal(0);
      const subscriber = vi.fn();
      signal.subscribe(subscriber);

      batch(() => {
        signal.set(1);
        batch(() => {
          signal.set(2);
        });
        signal.set(3);
      });

      // All notifications happen after outermost batch
      expect(subscriber).toHaveBeenCalledTimes(3);
      expect(signal.get()).toBe(3);
    });
  });
});

describe("keys", () => {
  describe("generateGameKey", () => {
    it("should generate compound key", () => {
      const key = generateGameKey("Chrono Trigger", "SNES");
      expect(key).toBe("chrono trigger___snes");
    });

    it("should handle empty name", () => {
      const key = generateGameKey("", "SNES");
      expect(key).toBe("");
    });

    it("should handle empty platform", () => {
      const key = generateGameKey("Chrono Trigger", "");
      expect(key).toBe("");
    });

    it("should normalize case", () => {
      const key1 = generateGameKey("CHRONO TRIGGER", "snes");
      const key2 = generateGameKey("chrono trigger", "SNES");
      expect(key1).toBe(key2);
    });

    it("should trim whitespace", () => {
      const key = generateGameKey("  Chrono Trigger  ", "  SNES  ");
      expect(key).toBe("chrono trigger___snes");
    });
  });

  describe("parseGameKey", () => {
    it("should parse valid key", () => {
      const result = parseGameKey("chrono trigger___snes");
      expect(result).toEqual({ name: "chrono trigger", platform: "snes" });
    });

    it("should return null for invalid key", () => {
      expect(parseGameKey("invalid")).toBeNull();
      expect(parseGameKey("")).toBeNull();
      expect(parseGameKey(null as any)).toBeNull();
    });
  });

  describe("withGameKey", () => {
    it("should add key to game object", () => {
      const game = {
        game_name: "Chrono Trigger",
        platform: "SNES",
        genre: "RPG",
        rating: "9.6",
        release_year: "1995",
      };
      const result = withGameKey(game);

      expect(result.key).toBe("chrono trigger___snes");
      expect(result.game_name).toBe("Chrono Trigger");
    });
  });

  describe("withGameKeys", () => {
    it("should add keys to multiple games", () => {
      const games = [
        {
          game_name: "Chrono Trigger",
          platform: "SNES",
          genre: "RPG",
          rating: "9.6",
          release_year: "1995",
        },
        {
          game_name: "Final Fantasy VI",
          platform: "SNES",
          genre: "RPG",
          rating: "9.5",
          release_year: "1994",
        },
      ];
      const result = withGameKeys(games);

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe("chrono trigger___snes");
      expect(result[1].key).toBe("final fantasy vi___snes");
    });
  });

  describe("keyMatchesGame", () => {
    it("should return true for matching key", () => {
      const game = {
        game_name: "Chrono Trigger",
        platform: "SNES",
        genre: "RPG",
        rating: "9.6",
        release_year: "1995",
      };
      expect(keyMatchesGame("chrono trigger___snes", game)).toBe(true);
    });

    it("should return false for non-matching key", () => {
      const game = {
        game_name: "Chrono Trigger",
        platform: "SNES",
        genre: "RPG",
        rating: "9.6",
        release_year: "1995",
      };
      expect(keyMatchesGame("final fantasy vi___snes", game)).toBe(false);
    });
  });

  describe("createGameLookup", () => {
    it("should create lookup map", () => {
      const games = withGameKeys([
        {
          game_name: "Chrono Trigger",
          platform: "SNES",
          genre: "RPG",
          rating: "9.6",
          release_year: "1995",
        },
        {
          game_name: "Final Fantasy VI",
          platform: "SNES",
          genre: "RPG",
          rating: "9.5",
          release_year: "1994",
        },
      ]);
      const lookup = createGameLookup(games);

      expect(lookup.size).toBe(2);
      expect(lookup.get("chrono trigger___snes")?.game_name).toBe("Chrono Trigger");
    });
  });
});
