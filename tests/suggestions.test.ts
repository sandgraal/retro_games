/**
 * Tests for community suggestions module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  fetchPendingSuggestions,
  moderateSuggestion,
  submitEditSuggestion,
  submitNewGameSuggestion,
  type SuggestionRecord,
} from "../src/data/suggestions";

// Mock auth module
vi.mock("../src/data/auth", () => ({
  getAuthSession: vi.fn().mockResolvedValue({
    sessionId: "test-session",
    role: "moderator",
    email: "mod@example.com",
    userId: "user-123",
    isAuthenticated: true,
  }),
  buildAuthHeaders: vi.fn().mockReturnValue({
    "x-session-id": "test-session",
    "x-role": "moderator",
  }),
}));

describe("Community Suggestions", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchPendingSuggestions", () => {
    it("should fetch pending suggestions from moderation endpoint", async () => {
      const mockSuggestions: SuggestionRecord[] = [
        {
          id: "test-1",
          type: "update",
          targetId: "chrono trigger___snes",
          delta: { genre: "RPG" },
          status: "pending",
          author: { role: "anonymous", email: null, sessionId: "sess-1" },
          submittedAt: "2025-12-11T00:00:00Z",
        },
        {
          id: "test-2",
          type: "new",
          targetId: null,
          delta: { title: "New Game", platform: "PS2" },
          status: "pending",
          author: { role: "contributor", email: "user@example.com", sessionId: "sess-2" },
          submittedAt: "2025-12-11T00:01:00Z",
        },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ suggestions: mockSuggestions }),
      });

      const result = await fetchPendingSuggestions();

      expect(result).toEqual(mockSuggestions);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/v1/moderation/suggestions?status=pending",
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-session-id": "test-session",
          }),
        })
      );
    });

    it("should return empty array when no suggestions", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ suggestions: [] }),
      });

      const result = await fetchPendingSuggestions();
      expect(result).toEqual([]);
    });

    it("should throw error on failed fetch", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        statusText: "Forbidden",
      });

      await expect(fetchPendingSuggestions()).rejects.toThrow(
        "Failed to fetch suggestions"
      );
    });
  });

  describe("moderateSuggestion", () => {
    it("should approve a suggestion", async () => {
      const mockResponse = {
        suggestion: {
          id: "test-123",
          type: "update",
          targetId: "chrono trigger___snes",
          delta: { genre: "RPG" },
          status: "approved",
          author: { role: "anonymous", email: null, sessionId: "sess-1" },
          submittedAt: "2025-12-11T00:00:00Z",
          decidedAt: "2025-12-11T00:05:00Z",
        },
        audit: {
          suggestionId: "test-123",
          decision: "approved",
          moderator: { sessionId: "test-session", role: "moderator" },
          timestamp: "2025-12-11T00:05:00Z",
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await moderateSuggestion("test-123", "approved", "Looks good");

      expect(result.suggestion.status).toBe("approved");
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/v1/moderation/suggestions/test-123/decision",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ status: "approved", notes: "Looks good" }),
        })
      );
    });

    it("should reject a suggestion with notes", async () => {
      const mockResponse = {
        suggestion: {
          id: "test-123",
          type: "update",
          status: "rejected",
          moderationNotes: "Duplicate entry",
        },
        audit: {
          suggestionId: "test-123",
          decision: "rejected",
          notes: "Duplicate entry",
        },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await moderateSuggestion("test-123", "rejected", "Duplicate entry");

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/v1/moderation/suggestions/test-123/decision",
        expect.objectContaining({
          body: JSON.stringify({ status: "rejected", notes: "Duplicate entry" }),
        })
      );
    });
  });

  describe("submitEditSuggestion", () => {
    it("should submit an edit suggestion for existing game", async () => {
      const mockSuggestion: SuggestionRecord = {
        id: "edit-123",
        type: "update",
        targetId: "chrono trigger___snes",
        delta: { genre: "JRPG", developer: "Square" },
        status: "pending",
        author: { role: "contributor", email: "user@example.com", sessionId: "sess-1" },
        submittedAt: "2025-12-11T00:00:00Z",
        notes: "Added developer info",
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ suggestion: mockSuggestion }),
      });

      const result = await submitEditSuggestion(
        "chrono trigger___snes",
        { genre: "JRPG", developer: "Square" },
        "Added developer info"
      );

      expect(result.type).toBe("update");
      expect(result.targetId).toBe("chrono trigger___snes");
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/v1/games/chrono%20trigger___snes/suggestions",
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("should throw error with message from server", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({ error: "Invalid delta payload" }),
      });

      await expect(submitEditSuggestion("chrono trigger___snes", {})).rejects.toThrow(
        "Invalid delta payload"
      );
    });
  });

  describe("submitNewGameSuggestion", () => {
    it("should submit a new game suggestion", async () => {
      const mockSuggestion: SuggestionRecord = {
        id: "new-123",
        type: "new",
        targetId: null,
        delta: {
          game_name: "Earthbound",
          platform: "SNES",
          genre: "RPG",
          release_year: 1994,
        },
        status: "pending",
        author: { role: "anonymous", email: null, sessionId: "sess-1" },
        submittedAt: "2025-12-11T00:00:00Z",
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ suggestion: mockSuggestion }),
      });

      const result = await submitNewGameSuggestion({
        game_name: "Earthbound",
        platform: "SNES",
        genre: "RPG",
        release_year: 1994,
      });

      expect(result.type).toBe("new");
      expect(result.delta.game_name).toBe("Earthbound");
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/v1/games/new",
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("should include notes when provided", async () => {
      const mockSuggestion: SuggestionRecord = {
        id: "new-123",
        type: "new",
        targetId: null,
        delta: { game_name: "Earthbound", platform: "SNES" },
        status: "pending",
        author: { role: "anonymous", email: null, sessionId: "sess-1" },
        submittedAt: "2025-12-11T00:00:00Z",
        notes: "Classic SNES RPG",
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ suggestion: mockSuggestion }),
      });

      await submitNewGameSuggestion(
        { game_name: "Earthbound", platform: "SNES" },
        "Classic SNES RPG"
      );

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.notes).toBe("Classic SNES RPG");
    });
  });
});
