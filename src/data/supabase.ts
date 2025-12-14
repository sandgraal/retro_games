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
 * Tries games_with_variants view first, falls back to direct game_variants query
 * Each row represents a game+platform combination for collection tracking
 */
export async function fetchGames(): Promise<Game[]> {
  const supabase = getClient();
  if (!supabase) {
    throw new Error("Supabase client not available");
  }

  // Type for the games_with_variants view response
  interface GamesWithVariantsRow {
    game_id: number;
    game_name: string;
    platform: string;
    genre: string;
    rating: number | string;
    rating_cat?: string;
    release_year: number | string;
    player_mode?: string;
    region?: string;
    player_count?: string;
    cover?: string;
    description?: string;
    developer?: string;
    publisher?: string;
    esrb_rating?: string;
    metacritic_score?: number;
    igdb_id?: number;
    updated_at?: string;
    variant_notes?: string;
  }

  // Try the denormalized view first (fastest)
  const viewResult = await supabase
    .from("games_with_variants")
    .select("*")
    .order("game_name", { ascending: true });

  if (!viewResult.error && viewResult.data && viewResult.data.length > 0) {
    // Cast to the expected view shape
    const rows = viewResult.data as unknown as GamesWithVariantsRow[];
    return rows.map((row) => ({
      id: row.game_id,
      game_name: row.game_name,
      platform: row.platform,
      genre: row.genre,
      rating: row.rating,
      rating_cat: row.rating_cat,
      release_year: row.release_year,
      player_mode: row.player_mode,
      region: row.region,
      player_count: row.player_count,
      cover: row.cover,
      description: row.description,
      developer: row.developer,
      publisher: row.publisher,
      esrb_rating: row.esrb_rating,
      metacritic_score: row.metacritic_score,
      igdb_id: row.igdb_id,
      updated_at: row.updated_at,
      notes: row.variant_notes,
    }));
  }

  // Fallback: Query game_variants with joined games data
  // This works even if the view hasn't been created yet
  console.warn("games_with_variants view not available, using fallback query");

  // Type for the nested join response
  interface GameVariantWithGame {
    id: string;
    platform: string;
    region?: string;
    local_title?: string;
    cover_url?: string;
    notes?: string;
    game_id: number;
    games: {
      id: number;
      game_name: string;
      genre?: string;
      rating?: number | string;
      rating_cat?: string;
      release_year?: number | string;
      player_mode?: string;
      player_count?: string;
      cover?: string;
      description?: string;
      developer?: string;
      publisher?: string;
      esrb_rating?: string;
      metacritic_score?: number;
      igdb_id?: number;
      updated_at?: string;
    };
  }

  const { data, error } = await supabase
    .from("game_variants")
    .select(
      `
      id,
      platform,
      region,
      local_title,
      cover_url,
      notes,
      game_id,
      games!inner (
        id,
        game_name,
        genre,
        rating,
        rating_cat,
        release_year,
        player_mode,
        player_count,
        cover,
        description,
        developer,
        publisher,
        esrb_rating,
        metacritic_score,
        igdb_id,
        updated_at
      )
    `
    )
    .order("local_title", { ascending: true });

  if (error) {
    throw new Error(`Supabase error: ${error.message}`);
  }

  // Cast and map the joined data to Game interface
  const rows = (data ?? []) as unknown as GameVariantWithGame[];
  return rows.map((row) => ({
    id: row.games.id,
    game_name: row.local_title || row.games.game_name || "Unknown",
    platform: row.platform,
    genre: row.games.genre || "",
    rating: row.games.rating || 0,
    rating_cat: row.games.rating_cat,
    release_year: row.games.release_year || 0,
    player_mode: row.games.player_mode,
    region: row.region,
    player_count: row.games.player_count,
    cover: row.cover_url || row.games.cover,
    description: row.games.description,
    developer: row.games.developer,
    publisher: row.games.publisher,
    esrb_rating: row.games.esrb_rating,
    metacritic_score: row.games.metacritic_score,
    igdb_id: row.games.igdb_id,
    updated_at: row.games.updated_at,
    notes: row.notes,
  }));
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
