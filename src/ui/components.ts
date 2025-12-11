/**
 * Component System
 * Lightweight reactive component primitives
 */

import type { Unsubscribe } from "../core/signals";

export interface ComponentContext {
  element: HTMLElement;
  cleanup: Unsubscribe[];
}

export type ComponentFunction = (ctx: ComponentContext) => void;

/**
 * Mount a component to an element
 */
export function mount(
  selector: string | HTMLElement,
  component: ComponentFunction
): Unsubscribe {
  const element =
    typeof selector === "string"
      ? document.querySelector<HTMLElement>(selector)
      : selector;

  if (!element) {
    console.warn(`Mount target not found: ${selector}`);
    return () => {};
  }

  const cleanup: Unsubscribe[] = [];
  const ctx: ComponentContext = { element, cleanup };

  component(ctx);

  return () => {
    cleanup.forEach((fn) => fn());
  };
}

/**
 * Create HTML from template string (safe for static content only)
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]): string {
  return strings.reduce((result, str, i) => {
    const value = values[i] ?? "";
    return result + str + escapeHtml(String(value));
  }, "");
}

/**
 * Escape HTML entities
 */
export function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Sanitize URL to prevent javascript: and data: protocol attacks
 * Only allows http: and https: protocols
 * Returns empty string for invalid or unsafe URLs
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return url;
    }
    // Reject any other protocol (javascript:, data:, etc.)
    return "";
  } catch {
    // Invalid URL format
    return "";
  }
}

/**
 * Create an element with attributes and children
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string | number | boolean | undefined>,
  ...children: (string | Node)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  if (attrs) {
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === undefined || value === false) return;
      if (value === true) {
        element.setAttribute(key, "");
      } else {
        element.setAttribute(key, String(value));
      }
    });
  }

  children.forEach((child) => {
    if (typeof child === "string") {
      element.appendChild(document.createTextNode(child));
    } else {
      element.appendChild(child);
    }
  });

  return element;
}

/**
 * Shorthand for common elements
 */
export const el = {
  div: (attrs?: Record<string, any>, ...children: (string | Node)[]) =>
    createElement("div", attrs, ...children),
  span: (attrs?: Record<string, any>, ...children: (string | Node)[]) =>
    createElement("span", attrs, ...children),
  button: (attrs?: Record<string, any>, ...children: (string | Node)[]) =>
    createElement("button", attrs, ...children),
  img: (attrs?: Record<string, any>) => createElement("img", attrs),
  input: (attrs?: Record<string, any>) => createElement("input", attrs),
  label: (attrs?: Record<string, any>, ...children: (string | Node)[]) =>
    createElement("label", attrs, ...children),
};

/**
 * Debounce a function
 */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle a function
 */
export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      fn(...args);
    }
  };
}
