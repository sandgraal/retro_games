/**
 * Supabase Client
 * Type-safe Supabase integration
 */

import type { Game, SupabaseConfig } from "../core/types";

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
    };
  };
}

// Global config from window
declare global {
  interface Window {
    __SUPABASE_CONFIG__?: SupabaseConfig;
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
 * Reset the client (for testing)
 */
export function resetClient(): void {
  client = null;
}
