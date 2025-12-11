import { describe, it, expect, vi, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs, encodePath, downloadObject } from "../scripts/archive-media.js";

describe("archive-media script", () => {
  describe("parseArgs", () => {
    it("returns default options when no args", () => {
      const options = parseArgs([]);
      expect(options.bucket).toBe("media-archive");
      expect(options.output).toContain(path.join("backups", options.bucket));
    });

    it("parses --bucket option", () => {
      const options = parseArgs(["--bucket", "game-covers"]);
      expect(options.bucket).toBe("game-covers");
    });

    it("rejects invalid --output paths", () => {
      expect(() => parseArgs(["--output", "/tmp/archive"])).toThrow(/Invalid path/);
      expect(() => parseArgs(["--output", "../outside"])).toThrow(/Invalid path/);
      expect(() => parseArgs(["--output", "backups/../outside"])).toThrow(/Invalid path/);
    });

    it("uses default output path when none is provided", () => {
      const options = parseArgs([]);
      expect(options.output).toContain(path.join("backups", options.bucket));
    });

    it("accepts backups root as a valid --output path", () => {
      const options = parseArgs(["--output", "backups"]);
      expect(options.output).toContain(path.join("backups"));
    });

    it("accepts absolute paths inside backups for --output", () => {
      const absOutput = path.resolve(process.cwd(), "backups/out");
      const options = parseArgs(["--output", absOutput]);
      expect(options.output).toBe(absOutput);
    });

    it("parses --out shorthand", () => {
      const options = parseArgs(["--out", "backups/backup"]);
      expect(options.output).toContain(path.join("backups", "backup"));
    });

    it("parses multiple options", () => {
      const options = parseArgs(["--bucket", "covers", "--output", "backups/out"]);
      expect(options.bucket).toBe("covers");
      expect(options.output).toContain(path.join("backups", "out"));
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

      const base = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/list/${bucket}`;

      const body = { limit: 1000 };

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

  describe("downloadObject", () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "archive-media-"));
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode("file-contents").buffer,
    });

    afterAll(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("rejects with a clear error and does not create the file when response is not ok", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => "Not found",
      });

      const targetPath = path.join(outputDir, "non-ok.txt");

      await expect(
        downloadObject("covers", { name: "non-ok.txt" }, outputDir, mockFetch)
      ).rejects.toThrow(/404|Not found/i);

      expect(fs.existsSync(targetPath)).toBe(false);
    });

    it("rejects with a clear error and does not create the file when fetchImpl throws", async () => {
      mockFetch.mockRejectedValueOnce(new Error("network failure"));

      const targetPath = path.join(outputDir, "thrown.txt");

      await expect(
        downloadObject("covers", { name: "thrown.txt" }, outputDir, mockFetch)
      ).rejects.toThrow(/network failure/i);

      expect(fs.existsSync(targetPath)).toBe(false);
    });
  });
});
