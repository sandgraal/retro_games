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
