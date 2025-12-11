import { describe, expect, it } from "vitest";
import { escapeHtml, sanitizeUrl } from "../src/ui/components";

describe("escapeHtml", () => {
  it("escapes basic HTML entities", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert('xss')&lt;/script&gt;"
    );
    expect(escapeHtml('Hello & "World"')).toBe('Hello &amp; "World"');
  });

  it("handles empty strings", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("handles strings without special characters", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World");
  });
});

describe("sanitizeUrl", () => {
  describe("allows safe URLs", () => {
    it("allows http URLs", () => {
      expect(sanitizeUrl("http://example.com")).toBe("http://example.com");
      expect(sanitizeUrl("http://example.com/path")).toBe("http://example.com/path");
      expect(sanitizeUrl("http://example.com/path?query=value")).toBe(
        "http://example.com/path?query=value"
      );
    });

    it("allows https URLs", () => {
      expect(sanitizeUrl("https://example.com")).toBe("https://example.com");
      expect(sanitizeUrl("https://example.com/path")).toBe("https://example.com/path");
      expect(sanitizeUrl("https://example.com/path?query=value")).toBe(
        "https://example.com/path?query=value"
      );
    });

    it("allows relative URLs starting with /", () => {
      expect(sanitizeUrl("/path/to/resource")).toBe("/path/to/resource");
      expect(sanitizeUrl("/path?query=value")).toBe("/path?query=value");
    });

    it("allows relative URLs starting with ./", () => {
      expect(sanitizeUrl("./path/to/resource")).toBe("./path/to/resource");
      expect(sanitizeUrl("./file.html")).toBe("./file.html");
    });

    it("allows relative URLs starting with ../", () => {
      expect(sanitizeUrl("../path/to/resource")).toBe("../path/to/resource");
      expect(sanitizeUrl("../../file.html")).toBe("../../file.html");
    });

    it("handles URLs with mixed case protocols correctly", () => {
      expect(sanitizeUrl("HTTP://example.com")).toBe("HTTP://example.com");
      expect(sanitizeUrl("HTTPS://example.com")).toBe("HTTPS://example.com");
      expect(sanitizeUrl("HtTpS://example.com")).toBe("HtTpS://example.com");
    });
  });

  describe("blocks dangerous URLs", () => {
    it("blocks javascript: protocol", () => {
      expect(sanitizeUrl("javascript:alert('xss')")).toBe("");
      expect(sanitizeUrl("JavaScript:alert('xss')")).toBe("");
      expect(sanitizeUrl("JAVASCRIPT:alert('xss')")).toBe("");
      expect(sanitizeUrl("  javascript:alert('xss')  ")).toBe("");
    });

    it("blocks data: protocol", () => {
      expect(sanitizeUrl("data:text/html,<script>alert('xss')</script>")).toBe("");
      expect(sanitizeUrl("DATA:text/html,<script>alert('xss')</script>")).toBe("");
      expect(sanitizeUrl("data:image/png;base64,iVBORw0KG")).toBe("");
    });

    it("blocks vbscript: protocol", () => {
      expect(sanitizeUrl("vbscript:msgbox('xss')")).toBe("");
      expect(sanitizeUrl("VBScript:msgbox('xss')")).toBe("");
    });

    it("blocks file: protocol", () => {
      expect(sanitizeUrl("file:///etc/passwd")).toBe("");
      expect(sanitizeUrl("FILE:///etc/passwd")).toBe("");
    });

    it("blocks other dangerous protocols", () => {
      expect(sanitizeUrl("ftp://example.com")).toBe("");
      expect(sanitizeUrl("tel:123456789")).toBe("");
      expect(sanitizeUrl("mailto:user@example.com")).toBe("");
      expect(sanitizeUrl("about:blank")).toBe("");
    });
  });

  describe("handles edge cases", () => {
    it("handles empty strings", () => {
      expect(sanitizeUrl("")).toBe("");
    });

    it("handles whitespace", () => {
      expect(sanitizeUrl("   ")).toBe("");
      expect(sanitizeUrl("  https://example.com  ")).toBe("https://example.com");
    });

    it("handles URLs without protocol", () => {
      expect(sanitizeUrl("example.com")).toBe("");
      expect(sanitizeUrl("www.example.com")).toBe("");
    });

    it("preserves original case for safe URLs", () => {
      expect(sanitizeUrl("https://Example.COM/Path")).toBe("https://Example.COM/Path");
    });
  });
});
