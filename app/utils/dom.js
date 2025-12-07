/**
 * Escape a string for safe HTML rendering.
 * Extracted from archive/app-legacy.js to prevent HTML injection from dynamic content.
 * @param {string|null|undefined} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return ch;
    }
  });
}
