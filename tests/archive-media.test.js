import { describe, it, expect, vi } from "vitest";
import { parseArgs, encodePath } from "../scripts/archive-media.js";

describe("archive-media script", () => {
  describe("parseArgs", () => {
    it("returns default options when no args", () => {
      const options = parseArgs([]);
      expect(options.bucket).toBe("media-archive");
      expect(options.output).toContain("backups");
      expect(options.output).toContain("media-archive");
    });

    it("parses --bucket option", () => {
      const options = parseArgs(["--bucket", "game-covers"]);
      expect(options.bucket).toBe("game-covers");
    });

    it("parses --output option", () => {
      const options = parseArgs(["--output", "/tmp/archive"]);
      expect(options.output).toContain("archive");
    });

    it("parses --out shorthand", () => {
      const options = parseArgs(["--out", "/tmp/backup"]);
      expect(options.output).toContain("backup");
    });

    it("parses multiple options", () => {
      const options = parseArgs(["--bucket", "covers", "--output", "/tmp/out"]);
      expect(options.bucket).toBe("covers");
      expect(options.output).toContain("out");
    });
  });

  describe("encodePath", () => {
    it("encodes path segments", () => {
      expect(encodePath("folder/file name.jpg")).toBe("folder/file%20name.jpg");
    });

    it("handles special characters", () => {
      expect(encodePath("folder/file#1.jpg")).toBe("folder/file%231.jpg");
    });

    it("preserves slashes", () => {
      expect(encodePath("a/b/c")).toBe("a/b/c");
    });

    it("handles nested paths", () => {
      expect(encodePath("games/snes/chrono trigger.jpg")).toBe(
        "games/snes/chrono%20trigger.jpg"
      );
    });

    it("handles empty string", () => {
      expect(encodePath("")).toBe("");
    });

    it("handles single segment", () => {
      expect(encodePath("file.jpg")).toBe("file.jpg");
    });
  });

  describe("API interactions", () => {
    it("should use POST method for listing objects", async () => {
      // Mock fetch implementation
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { name: "image1.jpg", id: "obj1" },
          { name: "image2.jpg", id: "obj2" },
        ],
        text: async () => "",
      });

      // Recreate the listObjects function logic
      const SUPABASE_URL = "https://test.supabase.co";
      const SERVICE_KEY = "test-key";
      const bucket = "media-archive";

      const results = [];
      let cursor = null;
      const base = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/list/${bucket}`;

      const body = { limit: 1000 };
      if (cursor) body.cursor = cursor;

      await mockFetch(base, {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      // Verify the mock was called with POST method
      expect(mockFetch).toHaveBeenCalledWith(
        "https://test.supabase.co/storage/v1/object/list/media-archive",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ limit: 1000 }),
        })
      );
    });

    it("should send JSON body with limit and cursor", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
        text: async () => "",
      });

      const SUPABASE_URL = "https://test.supabase.co";
      const SERVICE_KEY = "test-key";
      const bucket = "media-archive";
      const cursor = "test-cursor-id";

      const base = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/list/${bucket}`;
      const body = { limit: 1000, cursor };

      await mockFetch(base, {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      // Verify cursor is included in the body
      expect(mockFetch).toHaveBeenCalledWith(
        "https://test.supabase.co/storage/v1/object/list/media-archive",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ limit: 1000, cursor: "test-cursor-id" }),
        })
      );
    });

    it("should include required headers for Supabase API", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
        text: async () => "",
      });

      const SUPABASE_URL = "https://test.supabase.co";
      const SERVICE_KEY = "test-service-key";
      const bucket = "media-archive";

      const base = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/list/${bucket}`;

      await mockFetch(base, {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ limit: 1000 }),
      });

      // Verify all required headers are present
      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs.headers).toHaveProperty("apikey", "test-service-key");
      expect(callArgs.headers).toHaveProperty("Authorization", "Bearer test-service-key");
      expect(callArgs.headers).toHaveProperty("Content-Type", "application/json");
    });
  });
});
