/**
 * Data Loader
 * Handles loading game data from various sources
 */

import type { Game, DataLoadResult } from "../core/types";
import * as supabase from "./supabase";

const SAMPLE_DATA_PATH = "./data/sample-games.json";

/**
 * Load games from Supabase with fallback to sample data
 */
export async function loadGames(): Promise<DataLoadResult> {
  // Check for force sample mode
  const forceSample = checkForceSampleMode();
  let fallbackReason: string | undefined;

  if (!forceSample) {
    const supabaseReady = await supabase.waitForSupabaseReady();

    if (supabaseReady) {
      try {
        const games = await supabase.fetchGames();
        if (games.length > 0) {
          return {
            games,
            source: "supabase",
            timestamp: Date.now(),
          };
        }
        fallbackReason = "Supabase returned no games";
      } catch (error) {
        console.warn("Supabase fetch failed, falling back to sample:", error);
        const message = error instanceof Error ? error.message : "Unknown Supabase error";
        fallbackReason = `Supabase fetch failed (${message})`;
      }
    } else {
      console.warn("Supabase config unavailable before timeout, using sample data");
      fallbackReason = "Supabase config unavailable before timeout";
    }
  }

  if (forceSample) {
    fallbackReason = "Sample mode forced via flag or query parameter";
  }

  // Fallback to sample data
  return loadSampleGames(fallbackReason);
}

/**
 * Load sample games from JSON
 */
export async function loadSampleGames(reason?: string): Promise<DataLoadResult> {
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
      reason,
    };
  } catch (error) {
    console.error("Failed to load sample games:", error);
    return {
      games: [],
      source: "sample",
      timestamp: Date.now(),
      reason: reason ?? "Sample games unavailable",
    };
  }
}

/**
 * Check if sample mode is forced via URL or global flag
 */
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
    // Ignore URL parsing errors
  }

  return false;
}
