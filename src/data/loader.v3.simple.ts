/**
 * Game Data Loader v3.0 (Simplified)
 * Loads games from Supabase or falls back to sample JSON
 */

import type { Game, GameWithKey } from "../core/types.v3";
import { withKeys } from "../core/keys.v3";

// === Configuration ===

interface SupabaseConfig {
  url: string;
  anonKey: string;
}

interface SupabaseClientSimple {
  from: (table: string) => {
    select: (columns?: string) => Promise<{ data: Game[] | null; error: unknown }>;
  };
}

// Access global config without redeclaring Window interface
const getWindowConfig = (): SupabaseConfig | undefined => {
  return (window as unknown as { __SUPABASE_CONFIG__?: SupabaseConfig })
    .__SUPABASE_CONFIG__;
};

const getSupabaseLib = ():
  | { createClient: (url: string, key: string) => SupabaseClientSimple }
  | undefined => {
  return (
    window as unknown as {
      supabase?: { createClient: (url: string, key: string) => SupabaseClientSimple };
    }
  ).supabase;
};

// === Supabase Client ===

let supabaseClient: SupabaseClientSimple | null = null;

function getSupabaseClient(): SupabaseClientSimple | null {
  if (supabaseClient) return supabaseClient;

  const config = getWindowConfig();
  const supabase = getSupabaseLib();

  if (!config?.url || !config?.anonKey || !supabase) {
    return null;
  }

  supabaseClient = supabase.createClient(config.url, config.anonKey);
  return supabaseClient;
}

// === Data Loading ===

async function loadFromSupabase(): Promise<Game[]> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase not configured");
  }

  const { data, error } = await client.from("games_consolidated").select("*");

  if (error) {
    throw error;
  }

  return data || [];
}

async function loadFromSampleJSON(): Promise<Game[]> {
  const response = await fetch("/data/sample-games.json");
  if (!response.ok) {
    throw new Error(`Failed to load sample games: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : data.games || [];
}

// === Main Export ===

export async function loadGameData(): Promise<GameWithKey[]> {
  let games: Game[] = [];
  let source = "unknown";

  try {
    // Try Supabase first
    games = await loadFromSupabase();
    source = "supabase";
    console.log(`Loaded ${games.length} games from Supabase`);
  } catch (supabaseError) {
    console.warn("Supabase load failed, falling back to sample JSON:", supabaseError);

    try {
      games = await loadFromSampleJSON();
      source = "sample";
      console.log(`Loaded ${games.length} games from sample JSON`);
    } catch (sampleError) {
      console.error("Failed to load sample JSON:", sampleError);
      throw new Error("Failed to load game data from any source");
    }
  }

  // Filter out invalid games
  const validGames = games.filter(
    (g) =>
      g &&
      typeof g.game_name === "string" &&
      g.game_name.trim() &&
      typeof g.platform === "string" &&
      g.platform.trim()
  );

  // Add keys
  const gamesWithKeys = withKeys(validGames);

  console.log(`✅ Processed ${gamesWithKeys.length} valid games from ${source}`);

  return gamesWithKeys;
}
