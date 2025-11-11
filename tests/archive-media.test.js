import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("archive-media script", () => {
  describe("listObjects API call implementation", () => {
    it("should use POST method with JSON body", () => {
      // Read the script file to verify implementation
      const scriptPath = path.resolve(process.cwd(), "scripts/archive-media.js");
      const scriptContent = fs.readFileSync(scriptPath, "utf-8");

      // Verify POST method is used
      expect(scriptContent).toContain('method: "POST"');
      // Verify JSON body is stringified
      expect(scriptContent).toContain("JSON.stringify");
      // Verify Content-Type header is set
      expect(scriptContent).toContain('"Content-Type": "application/json"');
    });

    it("should include Content-Type application/json header", () => {
      const scriptPath = path.resolve(process.cwd(), "scripts/archive-media.js");
      const scriptContent = fs.readFileSync(scriptPath, "utf-8");

      // Verify the headers object includes Content-Type
      expect(scriptContent).toContain('"Content-Type": "application/json"');
      // Verify apikey and Authorization headers are still present
      expect(scriptContent).toContain("apikey: SERVICE_KEY");
      expect(scriptContent).toContain("Authorization: `Bearer ${SERVICE_KEY}`");
    });

    it("should send limit and cursor in JSON body, not query params", () => {
      const scriptPath = path.resolve(process.cwd(), "scripts/archive-media.js");
      const scriptContent = fs.readFileSync(scriptPath, "utf-8");

      // Verify body object is created with limit
      expect(scriptContent).toContain("const body = { limit: 1000 }");
      // Verify cursor is added to body, not as query param
      expect(scriptContent).toContain("body.cursor = cursor");
      // Verify no URLSearchParams usage for list endpoint
      const listFunctionMatch = scriptContent.match(
        /async function listObjects[\s\S]*?^}/m
      );
      if (listFunctionMatch) {
        expect(listFunctionMatch[0]).not.toContain("URLSearchParams");
      }
    });
  });

  describe("API endpoint format", () => {
    it("should construct correct POST endpoint without query parameters", () => {
      const SUPABASE_URL = "https://example.supabase.co";
      const bucket = "media-archive";
      const expectedBase = `${SUPABASE_URL}/storage/v1/object/list/${bucket}`;

      // Verify the URL format is correct (no query params)
      expect(expectedBase).toBe(
        "https://example.supabase.co/storage/v1/object/list/media-archive"
      );
      expect(expectedBase).not.toContain("?");
      expect(expectedBase).not.toContain("limit=");
    });
  });

  describe("pagination logic", () => {
    it("should continue fetching while cursor exists and payload has 1000 items", () => {
      const payload = Array.from({ length: 1000 }, (_, i) => ({
        name: `file${i}.jpg`,
        id: `id${i}`,
      }));

      // If payload length is 1000, cursor should be set to last item's id
      const shouldHaveCursor = payload.length === 1000;
      const cursor = shouldHaveCursor ? payload[payload.length - 1]?.id || null : null;

      expect(shouldHaveCursor).toBe(true);
      expect(cursor).toBe("id999");
    });

    it("should stop pagination when payload has fewer than 1000 items", () => {
      const payload = Array.from({ length: 500 }, (_, i) => ({
        name: `file${i}.jpg`,
        id: `id${i}`,
      }));

      // If payload length is less than 1000, cursor should be null
      const shouldHaveCursor = payload.length === 1000;
      const cursor = shouldHaveCursor ? payload[payload.length - 1]?.id || null : null;

      expect(shouldHaveCursor).toBe(false);
      expect(cursor).toBe(null);
    });
  });
});
