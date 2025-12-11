import { describe, expect, it } from "vitest";
import { sanitizeUrl, escapeHtml } from "../src/ui/components";

describe("sanitizeUrl", () => {
  it("allows https:// URLs", () => {
    const url = "https://example.com/page";
    expect(sanitizeUrl(url)).toBe(url);
  });

  it("allows http:// URLs", () => {
    const url = "http://example.com/page";
    expect(sanitizeUrl(url)).toBe(url);
  });

  it("rejects javascript: protocol", () => {
    const url = "javascript:alert('xss')";
    expect(sanitizeUrl(url)).toBe("");
  });

  it("rejects data: protocol", () => {
    const url = "data:text/html,<script>alert('xss')</script>";
    expect(sanitizeUrl(url)).toBe("");
  });

  it("rejects file: protocol", () => {
    const url = "file:///etc/passwd";
    expect(sanitizeUrl(url)).toBe("");
  });

  it("rejects ftp: protocol", () => {
    const url = "ftp://example.com/file";
    expect(sanitizeUrl(url)).toBe("");
  });

  it("rejects vbscript: protocol", () => {
    const url = "vbscript:msgbox('xss')";
    expect(sanitizeUrl(url)).toBe("");
  });

  it("returns empty string for invalid URLs", () => {
    expect(sanitizeUrl("not-a-url")).toBe("");
    expect(sanitizeUrl("//example.com")).toBe("");
    expect(sanitizeUrl("")).toBe("");
  });

  it("handles URLs with query parameters", () => {
    const url = "https://example.com/page?param=value&other=123";
    expect(sanitizeUrl(url)).toBe(url);
  });

  it("handles URLs with fragments", () => {
    const url = "https://example.com/page#section";
    expect(sanitizeUrl(url)).toBe(url);
  });

  it("handles URLs with ports", () => {
    const url = "https://example.com:8080/page";
    expect(sanitizeUrl(url)).toBe(url);
  });

  it("handles URLs with authentication", () => {
    const url = "https://user:pass@example.com/page";
    expect(sanitizeUrl(url)).toBe(url);
  });
});

describe("escapeHtml", () => {
  it("escapes HTML special characters", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert('xss')&lt;/script&gt;"
    );
    expect(escapeHtml('He said "Hello"')).toBe('He said "Hello"');
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });

  it("handles empty strings", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("handles strings with no special characters", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World");
  });
});
