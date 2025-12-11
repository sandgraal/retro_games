/**
 * Tests for community suggestions module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  decideSuggestion,
  fetchPendingSuggestions,
  submitSuggestion,
  type SuggestionRecord,
  type AuditLogEntry,
} from "../src/data/suggestions";

describe("Community Suggestions", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("decideSuggestion", () => {
    it("should handle response with audit log", async () => {
      const mockSuggestion: SuggestionRecord = {
        id: "test-123",
        game_name: "Chrono Trigger",
        platform: "SNES",
        status: "approved",
        created_at: "2025-12-11T00:00:00Z",
      };

      const mockAudit: AuditLogEntry = {
        id: "audit-456",
        suggestion_id: "test-123",
        moderator_email: "mod@example.com",
        action: "approve",
        timestamp: "2025-12-11T00:01:00Z",
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          suggestion: mockSuggestion,
          audit: mockAudit,
        }),
      });

      const result = await decideSuggestion(
        "test-123",
        { action: "approve" },
        "mod@example.com"
      );

      expect(result.suggestion).toEqual(mockSuggestion);
      expect(result.audit).toEqual(mockAudit);
    });

    it("should handle response without audit log (demonstrates the bug)", async () => {
      const mockSuggestion: SuggestionRecord = {
        id: "test-123",
        game_name: "Chrono Trigger",
        platform: "SNES",
        status: "pending",
        created_at: "2025-12-11T00:00:00Z",
      };

      // Server returns suggestion without audit (e.g., audit logging failed)
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          suggestion: mockSuggestion,
          // audit is undefined
        }),
      });

      const result = await decideSuggestion(
        "test-123",
        { action: "approve" },
        "mod@example.com"
      );

      expect(result.suggestion).toEqual(mockSuggestion);
      // With the fix, audit is correctly typed as optional
      // so accessing it as undefined is properly handled
      expect(result.audit).toBeUndefined();
    });

    it("should include decision reason in request", async () => {
      const mockSuggestion: SuggestionRecord = {
        id: "test-123",
        game_name: "Fake Game",
        platform: "SNES",
        status: "rejected",
        created_at: "2025-12-11T00:00:00Z",
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ suggestion: mockSuggestion }),
      });

      await decideSuggestion(
        "test-123",
        { action: "reject", reason: "Duplicate entry" },
        "mod@example.com"
      );

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/suggestions/test-123/decide",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Duplicate entry"),
        })
      );
    });
  });

  describe("fetchPendingSuggestions", () => {
    it("should fetch pending suggestions", async () => {
      const mockSuggestions: SuggestionRecord[] = [
        {
          id: "test-1",
          game_name: "Game 1",
          platform: "PS2",
          status: "pending",
          created_at: "2025-12-11T00:00:00Z",
        },
        {
          id: "test-2",
          game_name: "Game 2",
          platform: "Xbox",
          status: "pending",
          created_at: "2025-12-11T00:01:00Z",
        },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuggestions,
      });

      const result = await fetchPendingSuggestions();

      expect(result).toEqual(mockSuggestions);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/suggestions?status=pending"
      );
    });

    it("should throw error on failed fetch", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        statusText: "Internal Server Error",
      });

      await expect(fetchPendingSuggestions()).rejects.toThrow(
        "Failed to fetch suggestions"
      );
    });
  });

  describe("submitSuggestion", () => {
    it("should submit a new suggestion", async () => {
      const mockSuggestion: SuggestionRecord = {
        id: "new-123",
        game_name: "Earthbound",
        platform: "SNES",
        status: "pending",
        created_at: "2025-12-11T00:00:00Z",
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuggestion,
      });

      const result = await submitSuggestion("Earthbound", "SNES");

      expect(result).toEqual(mockSuggestion);
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/suggestions",
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("should include submitter email when provided", async () => {
      const mockSuggestion: SuggestionRecord = {
        id: "new-123",
        game_name: "Earthbound",
        platform: "SNES",
        submitter_email: "user@example.com",
        status: "pending",
        created_at: "2025-12-11T00:00:00Z",
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuggestion,
      });

      const result = await submitSuggestion(
        "Earthbound",
        "SNES",
        "user@example.com"
      );

      expect(result.submitter_email).toBe("user@example.com");
    });
  });
});
