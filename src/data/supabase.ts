/**
 * Supabase Client
 * Type-safe Supabase integration with Auth support
 */

import type { Game, SupabaseConfig } from "../core/types";

// Auth types
interface AuthUser {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

interface AuthSession {
  user: AuthUser | null;
  access_token?: string;
}

interface AuthResponse {
  data: { session: AuthSession | null; user?: AuthUser | null };
  error: { message: string } | null;
}

// Supabase client types (minimal subset we need)
interface SupabaseClient {
  from: (table: string) => {
    select: (columns?: string) => {
      order: (
        column: string,
        options: { ascending: boolean }
      ) => Promise<{
        data: Game[] | null;
        error: { message: string } | null;
      }>;
      eq: (
        column: string,
        value: unknown
      ) => Promise<{
        data: unknown[] | null;
        error: { message: string } | null;
      }>;
    };
    insert: (data: unknown) => Promise<{
      data: unknown;
      error: { message: string } | null;
    }>;
    update: (data: unknown) => {
      eq: (
        column: string,
        value: unknown
      ) => Promise<{
        data: unknown;
        error: { message: string } | null;
      }>;
    };
  };
  auth: {
    getSession: () => Promise<AuthResponse>;
    signInWithOAuth: (options: {
      provider: "github" | "google";
      options?: { redirectTo?: string };
    }) => Promise<AuthResponse>;
    signOut: () => Promise<{ error: { message: string } | null }>;
    onAuthStateChange: (
      callback: (event: string, session: AuthSession | null) => void
    ) => { data: { subscription: { unsubscribe: () => void } } };
  };
  rpc: (
    fn: string,
    params?: Record<string, unknown>
  ) => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

// Global config from window
declare global {
  interface Window {
    __SUPABASE_CONFIG__?: SupabaseConfig;
    __SANDGRAAL_FORCE_SAMPLE__?: boolean;
    __SANDGRAAL_SCALE_TEST__?: boolean;
    supabase?: {
      createClient: (url: string, key: string) => SupabaseClient;
    };
  }
}

let client: SupabaseClient | null = null;

const SUPABASE_READY_TIMEOUT_MS = 4000;
const SUPABASE_READY_POLL_MS = 50;

/**
 * Get the Supabase configuration from window
 */
export function getConfig(): SupabaseConfig | null {
  const config = window.__SUPABASE_CONFIG__;
  if (!config?.url || !config?.anonKey) {
    return null;
  }
  return config;
}

/**
 * Check if Supabase is available
 */
export function isAvailable(): boolean {
  return !!getConfig() && !!window.supabase;
}

/**
 * Wait for Supabase globals and config to be ready
 * Ensures the CDN script and config.js have both executed before attempting queries
 */
export async function waitForSupabaseReady(
  timeoutMs = SUPABASE_READY_TIMEOUT_MS
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // Skip Supabase bootstrap when running in forced sample or scale test modes
  if (window.__SANDGRAAL_FORCE_SAMPLE__ || window.__SANDGRAAL_SCALE_TEST__) {
    return false;
  }

  if (isAvailable()) return true;

  const ensureConfigScript = (): void => {
    const hasScript = document.querySelector('script[src="config.js"]');
    if (!hasScript) {
      const script = document.createElement("script");
      script.src = "config.js";
      script.async = true;
      document.head.appendChild(script);
    }
  };

  ensureConfigScript();

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (isAvailable()) return true;
    await new Promise((resolve) => setTimeout(resolve, SUPABASE_READY_POLL_MS));
  }

  return isAvailable();
}

/**
 * Get or create the Supabase client
 */
export function getClient(): SupabaseClient | null {
  if (client) return client;

  const config = getConfig();
  if (!config || !window.supabase) {
    console.warn("Supabase not available - using sample data");
    return null;
  }

  client = window.supabase.createClient(config.url, config.anonKey);
  return client;
}

/**
 * Fetch games from Supabase
 */
export async function fetchGames(): Promise<Game[]> {
  const supabase = getClient();
  if (!supabase) {
    throw new Error("Supabase client not available");
  }

  const { data, error } = await supabase
    .from("games_consolidated")
    .select("*")
    .order("game_name", { ascending: true });

  if (error) {
    throw new Error(`Supabase error: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Sign in with GitHub OAuth
 */
export async function signInWithGitHub(): Promise<void> {
  const supabase = getClient();
  if (!supabase) {
    throw new Error("Supabase not available");
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: window.location.origin,
    },
  });

  if (error) {
    throw new Error(`GitHub sign-in failed: ${error.message}`);
  }
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;

  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Sign out error:", error.message);
  }
}

/**
 * Get current auth session
 */
export async function getSupabaseSession(): Promise<AuthSession | null> {
  const supabase = getClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("Session error:", error.message);
    return null;
  }

  return data.session;
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(
  callback: (event: string, session: AuthSession | null) => void
): () => void {
  const supabase = getClient();
  if (!supabase) return () => {};

  const { data } = supabase.auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}

/**
 * Call a Supabase RPC function
 */
export async function callRpc<T = unknown>(
  fn: string,
  params?: Record<string, unknown>
): Promise<T | null> {
  const supabase = getClient();
  if (!supabase) {
    throw new Error("Supabase not available");
  }

  const { data, error } = await supabase.rpc(fn, params);
  if (error) {
    throw new Error(`RPC ${fn} failed: ${error.message}`);
  }

  return data as T;
}

/**
 * Submit a catalog submission to Supabase
 */
export async function submitCatalogSubmission(submission: {
  game_id?: string;
  submission_type: "new" | "edit" | "delete";
  payload: Record<string, unknown>;
}): Promise<string> {
  const supabase = getClient();
  if (!supabase) {
    throw new Error("Supabase not available");
  }

  const { data, error } = await supabase.from("catalog_submissions").insert(submission);

  if (error) {
    throw new Error(`Submission failed: ${error.message}`);
  }

  return (data as { id: string })?.id ?? "";
}

/**
 * Search games using the search_games RPC function
 */
export async function searchGames(
  query: string,
  limit = 50,
  offset = 0
): Promise<Game[]> {
  const supabase = getClient();
  if (!supabase) {
    throw new Error("Supabase not available");
  }

  const { data, error } = await supabase.rpc("search_games", {
    search_query: query,
    limit_count: limit,
    offset_count: offset,
  });

  if (error) {
    throw new Error(`Search failed: ${error.message}`);
  }

  return (data as Game[]) ?? [];
}

/**
 * Reset the client (for testing)
 */
export function resetClient(): void {
  client = null;
}
