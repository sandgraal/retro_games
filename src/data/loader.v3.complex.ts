/**
 * Data Loader v3.0
 * Handles loading game data from various sources with proper caching
 */

import type {
  Game,
  GameWithKey,
  DataSource,
  DataLoadResult,
  PriceData,
} from "../core/types.v3";
import { withKeys } from "../core/keys.v3";
import {
  getAll,
  putMany,
  getCache,
  setCache,
  STORES,
  count as dbCount,
} from "../core/storage";

// === Configuration ===

const SAMPLE_DATA_PATH = "./data/sample-games.json";
const PRICE_DATA_PATH = "./data/sample-price-history.json";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// === Supabase Client ===

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

declare global {
  interface Window {
    __SUPABASE_CONFIG__?: {
      url: string;
      anonKey: string;
    };
    supabase?: {
      createClient: (url: string, key: string) => SupabaseClient;
    };
    __SANDGRAAL_FORCE_SAMPLE__?: boolean;
  }
}

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const config = window.__SUPABASE_CONFIG__;
  if (!config?.url || !config?.anonKey || !window.supabase) {
    return null;
  }

  supabaseClient = window.supabase.createClient(config.url, config.anonKey);
  return supabaseClient;
}

function isSupabaseAvailable(): boolean {
  return !!getSupabaseClient();
}

// === Loaders ===

/**
 * Main data loader - tries sources in order of preference
 */
export async function loadGames(): Promise<DataLoadResult> {
  const forceSample = checkForceSampleMode();

  // 1. Try IndexedDB cache first (instant load)
  if (!forceSample) {
    const cached = await loadFromIndexedDB();
    if (cached) {
      // Refresh in background
      refreshFromSource().catch(console.warn);
      return cached;
    }
  }

  // 2. Try Supabase
  if (!forceSample && isSupabaseAvailable()) {
    try {
      const result = await loadFromSupabase();
      if (result.games.length > 0) {
        // Cache for next time
        await cacheGames(result.games);
        return result;
      }
    } catch (error) {
      console.warn("Supabase load failed:", error);
    }
  }

  // 3. Fall back to sample data
  return loadFromSample();
}

/**
 * Load from IndexedDB
 */
async function loadFromIndexedDB(): Promise<DataLoadResult | null> {
  try {
    const count = await dbCount(STORES.GAMES);
    if (count === 0) return null;

    const games = await getAll<GameWithKey>(STORES.GAMES);
    if (games.length === 0) return null;

    return {
      games,
      source: "indexeddb",
      timestamp: Date.now(),
      fromCache: true,
    };
  } catch (error) {
    console.warn("IndexedDB load failed:", error);
    return null;
  }
}

/**
 * Load from Supabase
 */
async function loadFromSupabase(): Promise<DataLoadResult> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase client not available");
  }

  const { data, error } = await client
    .from("games_consolidated")
    .select("*")
    .order("game_name", { ascending: true });

  if (error) {
    throw new Error(`Supabase error: ${error.message}`);
  }

  return {
    games: data ?? [],
    source: "supabase",
    timestamp: Date.now(),
    fromCache: false,
  };
}

/**
 * Load from sample JSON
 */
async function loadFromSample(): Promise<DataLoadResult> {
  try {
    const response = await fetch(SAMPLE_DATA_PATH);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const games: Game[] = Array.isArray(data) ? data : (data.games ?? []);

    return {
      games,
      source: "sample",
      timestamp: Date.now(),
      fromCache: false,
    };
  } catch (error) {
    console.error("Sample data load failed:", error);
    return {
      games: [],
      source: "sample",
      timestamp: Date.now(),
      fromCache: false,
    };
  }
}

/**
 * Cache games to IndexedDB
 */
async function cacheGames(games: Game[]): Promise<void> {
  try {
    const gamesWithKeys = withKeys(games);
    await putMany(STORES.GAMES, gamesWithKeys);
  } catch (error) {
    console.warn("Failed to cache games:", error);
  }
}

/**
 * Background refresh from source
 */
async function refreshFromSource(): Promise<void> {
  // Check if we should refresh (based on cache age)
  const lastRefresh = await getCache<number>("lastGamesRefresh");
  if (lastRefresh && Date.now() - lastRefresh < CACHE_TTL) {
    return;
  }

  // Try Supabase refresh
  if (isSupabaseAvailable()) {
    try {
      const result = await loadFromSupabase();
      if (result.games.length > 0) {
        await cacheGames(result.games);
        await setCache("lastGamesRefresh", Date.now());

        // Dispatch custom event for UI to react
        window.dispatchEvent(
          new CustomEvent("gamesRefreshed", {
            detail: { count: result.games.length },
          })
        );
      }
    } catch (error) {
      console.warn("Background refresh failed:", error);
    }
  }
}

// === Price Data ===

export async function loadPrices(): Promise<Record<string, PriceData>> {
  // Check cache first
  const cached = await getCache<Record<string, PriceData>>("priceData");
  if (cached) {
    // Background refresh
    refreshPrices().catch(console.warn);
    return cached;
  }

  return fetchPrices();
}

async function fetchPrices(): Promise<Record<string, PriceData>> {
  try {
    const response = await fetch(PRICE_DATA_PATH);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const prices: Record<string, PriceData> = {};

    if (data.latest && Array.isArray(data.latest)) {
      for (const p of data.latest) {
        if (p.game_key) {
          prices[p.game_key] = {
            loose: p.loose_price_cents,
            cib: p.cib_price_cents,
            new: p.new_price_cents,
            currency: p.currency ?? "USD",
            snapshotDate: p.snapshot_date,
          };
        }
      }
    }

    // Cache for 24 hours
    await setCache("priceData", prices, CACHE_TTL);

    return prices;
  } catch (error) {
    console.warn("Price data unavailable:", error);
    return {};
  }
}

async function refreshPrices(): Promise<void> {
  const lastRefresh = await getCache<number>("lastPriceRefresh");
  if (lastRefresh && Date.now() - lastRefresh < CACHE_TTL) {
    return;
  }

  await fetchPrices();
  await setCache("lastPriceRefresh", Date.now());
}

// === Helpers ===

function checkForceSampleMode(): boolean {
  if (typeof window === "undefined") return false;

  // Check global flag
  if (window.__SANDGRAAL_FORCE_SAMPLE__) {
    return true;
  }

  // Check URL parameter
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("sample") === "1") {
      return true;
    }
  } catch {
    // Ignore
  }

  return false;
}

// === Search ===

/**
 * Fast text search (for autocomplete)
 */
export async function searchGames(
  games: readonly GameWithKey[],
  query: string,
  limit = 20
): Promise<GameWithKey[]> {
  if (!query.trim()) {
    return [];
  }

  const queryLower = query.toLowerCase().trim();
  const results: Array<{ game: GameWithKey; score: number }> = [];

  for (const game of games) {
    const name = game.game_name.toLowerCase();

    // Exact match
    if (name === queryLower) {
      results.push({ game, score: 1000 });
      continue;
    }

    // Starts with
    if (name.startsWith(queryLower)) {
      results.push({ game, score: 500 + (100 - name.length) });
      continue;
    }

    // Contains
    if (name.includes(queryLower)) {
      const index = name.indexOf(queryLower);
      results.push({ game, score: 200 - index });
      continue;
    }

    // Word starts with
    const words = name.split(/\s+/);
    for (const word of words) {
      if (word.startsWith(queryLower)) {
        results.push({ game, score: 100 });
        break;
      }
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.game);
}

// === Validation ===

export function validateGame(game: unknown): game is Game {
  if (!game || typeof game !== "object") return false;

  const g = game as Record<string, unknown>;

  return (
    typeof g.game_name === "string" &&
    g.game_name.length > 0 &&
    typeof g.platform === "string" &&
    g.platform.length > 0
  );
}

export function validateGames(games: unknown): games is Game[] {
  return Array.isArray(games) && games.every(validateGame);
}

// === Export ===

export { isSupabaseAvailable, loadFromSample as loadSampleGames, cacheGames };
