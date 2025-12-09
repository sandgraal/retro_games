/**
 * Router - URL-driven state machine
 * Single source of truth for application state derived from URL
 */

import { signal, computed, type Computed } from "./runtime";

// === Types ===

export interface Route {
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
  hash: string;
}

export interface RouteMatch {
  matched: boolean;
  params: Record<string, string>;
}

type RouteHandler = (route: Route) => void;
type RouteGuard = (
  to: Route,
  from: Route | null
) => boolean | string | Promise<boolean | string>;

// === Router State ===

const currentRoute = signal<Route>(parseLocation());
const isNavigating = signal(false);

// === Parse/Serialize ===

function parseLocation(): Route {
  const path = window.location.pathname;
  const query = new URLSearchParams(window.location.search);
  const hash = window.location.hash.slice(1);

  return {
    path,
    params: {},
    query,
    hash,
  };
}

function serializeRoute(route: Partial<Route>): string {
  const path = route.path || "/";
  const query = route.query?.toString() || "";
  const hash = route.hash || "";

  let url = path;
  if (query) url += "?" + query;
  if (hash) url += "#" + hash;

  return url;
}

// === Pattern Matching ===

export function matchPath(pattern: string, path: string): RouteMatch {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    // Check for wildcard
    if (!pattern.includes("*")) {
      return { matched: false, params: {} };
    }
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart === "*") {
      params["*"] = pathParts.slice(i).join("/");
      return { matched: true, params };
    }

    if (patternPart.startsWith(":")) {
      const paramName = patternPart.slice(1);
      params[paramName] = pathPart || "";
      continue;
    }

    if (patternPart !== pathPart) {
      return { matched: false, params: {} };
    }
  }

  return { matched: true, params };
}

// === Router Class ===

class Router {
  private routes = new Map<string, RouteHandler>();
  private guards: RouteGuard[] = [];
  private defaultHandler?: RouteHandler;

  constructor() {
    // Listen for popstate (back/forward navigation)
    window.addEventListener("popstate", () => {
      this.handleNavigation(parseLocation(), false);
    });

    // Listen for link clicks
    document.addEventListener("click", (e) => {
      const target = (e.target as Element).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Skip external links
      if (href.startsWith("http") || href.startsWith("//")) return;

      // Skip links with special attributes
      if (target.hasAttribute("download") || target.getAttribute("target") === "_blank")
        return;

      e.preventDefault();
      this.navigate(href);
    });
  }

  // Register a route handler
  on(pattern: string, handler: RouteHandler): this {
    this.routes.set(pattern, handler);
    return this;
  }

  // Register default handler
  otherwise(handler: RouteHandler): this {
    this.defaultHandler = handler;
    return this;
  }

  // Add navigation guard
  beforeEach(guard: RouteGuard): this {
    this.guards.push(guard);
    return this;
  }

  // Navigate to a new route
  async navigate(
    to: string | Partial<Route>,
    options: { replace?: boolean } = {}
  ): Promise<boolean> {
    const newRoute =
      typeof to === "string"
        ? { ...parseLocation(), path: to }
        : { ...parseLocation(), ...to };

    return this.handleNavigation(newRoute as Route, true, options.replace);
  }

  // Update query params without full navigation
  updateQuery(params: Record<string, string | null>): void {
    const route = currentRoute();
    const query = new URLSearchParams(route.query);

    for (const [key, value] of Object.entries(params)) {
      if (value === null) {
        query.delete(key);
      } else {
        query.set(key, value);
      }
    }

    const newRoute = { ...route, query };
    const url = serializeRoute(newRoute);
    window.history.replaceState(null, "", url);
    currentRoute.set(newRoute);
  }

  // Handle navigation
  private async handleNavigation(
    route: Route,
    pushState: boolean,
    replace: boolean = false
  ): Promise<boolean> {
    const from = currentRoute();

    isNavigating.set(true);

    try {
      // Run guards
      for (const guard of this.guards) {
        const result = await guard(route, from);

        if (result === false) {
          isNavigating.set(false);
          return false;
        }

        if (typeof result === "string") {
          // Redirect
          return this.navigate(result, { replace: true });
        }
      }

      // Find matching route
      let matched = false;
      for (const [pattern, handler] of this.routes) {
        const match = matchPath(pattern, route.path);
        if (match.matched) {
          route.params = match.params;
          handler(route);
          matched = true;
          break;
        }
      }

      if (!matched && this.defaultHandler) {
        this.defaultHandler(route);
      }

      // Update URL
      if (pushState) {
        const url = serializeRoute(route);
        if (replace) {
          window.history.replaceState(null, "", url);
        } else {
          window.history.pushState(null, "", url);
        }
      }

      // Update state
      currentRoute.set(route);

      return true;
    } finally {
      isNavigating.set(false);
    }
  }

  // Start router
  start(): void {
    const route = parseLocation();
    this.handleNavigation(route, false);
  }
}

// === Singleton Export ===

let routerInstance: Router | null = null;

export function getRouter(): Router {
  if (!routerInstance) {
    routerInstance = new Router();
  }
  return routerInstance;
}

export function createRouter(): Router {
  return new Router();
}

// === Reactive Exports ===

export const route: Computed<Route> = computed(() => currentRoute());
export const navigating: Computed<boolean> = computed(() => isNavigating());

// === Query Parameter Helpers ===

export function queryParam(name: string): Computed<string | null> {
  return computed(() => currentRoute().query.get(name));
}

export function queryParams(): Computed<Record<string, string>> {
  return computed(() => {
    const params: Record<string, string> = {};
    for (const [key, value] of currentRoute().query.entries()) {
      params[key] = value;
    }
    return params;
  });
}

// === Filter State from URL ===

export interface URLFilterState {
  platforms: Set<string>;
  genres: Set<string>;
  search: string;
  sortBy: string;
  sortDir: "asc" | "desc";
  view: string;
  status: string;
}

export function getFiltersFromURL(): URLFilterState {
  const query = currentRoute().query;

  return {
    platforms: new Set(query.get("platforms")?.split(",").filter(Boolean) || []),
    genres: new Set(query.get("genres")?.split(",").filter(Boolean) || []),
    search: query.get("q") || "",
    sortBy: query.get("sort") || "name",
    sortDir: (query.get("dir") as "asc" | "desc") || "asc",
    view: query.get("view") || "grid",
    status: query.get("status") || "",
  };
}

export function setFiltersToURL(filters: Partial<URLFilterState>): void {
  const router = getRouter();
  const params: Record<string, string | null> = {};

  if (filters.platforms !== undefined) {
    const platforms = [...filters.platforms].join(",");
    params.platforms = platforms || null;
  }

  if (filters.genres !== undefined) {
    const genres = [...filters.genres].join(",");
    params.genres = genres || null;
  }

  if (filters.search !== undefined) {
    params.q = filters.search || null;
  }

  if (filters.sortBy !== undefined) {
    params.sort = filters.sortBy === "name" ? null : filters.sortBy;
  }

  if (filters.sortDir !== undefined) {
    params.dir = filters.sortDir === "asc" ? null : filters.sortDir;
  }

  if (filters.view !== undefined) {
    params.view = filters.view === "grid" ? null : filters.view;
  }

  if (filters.status !== undefined) {
    params.status = filters.status || null;
  }

  router.updateQuery(params);
}

// === Share Code Support ===

export function getShareCodeFromURL(): string | null {
  return currentRoute().query.get("share");
}

export function setShareCodeToURL(code: string | null): void {
  const router = getRouter();
  router.updateQuery({ share: code });
}

export function clearShareCodeFromURL(): void {
  setShareCodeToURL(null);
}

// === Game Modal Support ===

export function getGameKeyFromURL(): string | null {
  const hash = currentRoute().hash;
  if (hash.startsWith("game/")) {
    return decodeURIComponent(hash.slice(5));
  }
  return null;
}

export function setGameKeyToURL(gameKey: string | null): void {
  const route = currentRoute();
  const newHash = gameKey ? `game/${encodeURIComponent(gameKey)}` : "";

  if (route.hash !== newHash) {
    const url = serializeRoute({ ...route, hash: newHash });
    window.history.pushState(null, "", url);
    currentRoute.set({ ...route, hash: newHash });
  }
}
