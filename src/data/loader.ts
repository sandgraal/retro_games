/**
 * Data Loader
 * Handles loading game data from various sources
 */

import type { Game, DataLoadResult } from "../core/types";
import * as supabase from "./supabase";

const SAMPLE_DATA_PATH = "./data/sample-games.json";
const PRICE_DATA_PATH = "./data/sample-price-history.json";

/**
 * Load games from Supabase with fallback to sample data
 */
export async function loadGames(): Promise<DataLoadResult> {
  // Check for force sample mode
  const forceSample = checkForceSampleMode();

  if (!forceSample && supabase.isAvailable()) {
    try {
      const games = await supabase.fetchGames();
      if (games.length > 0) {
        return {
          games,
          source: "supabase",
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      console.warn("Supabase fetch failed, falling back to sample:", error);
    }
  }

  // Fallback to sample data
  return loadSampleGames();
}

/**
 * Load sample games from JSON
 */
export async function loadSampleGames(): Promise<DataLoadResult> {
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
    };
  } catch (error) {
    console.error("Failed to load sample games:", error);
    return {
      games: [],
      source: "sample",
      timestamp: Date.now(),
    };
  }
}

/**
 * Load price data
 */
export async function loadPrices(): Promise<
  Record<
    string,
    {
      loose?: number;
      cib?: number;
      new?: number;
      currency: string;
      snapshotDate?: string;
    }
  >
> {
  try {
    const response = await fetch(PRICE_DATA_PATH);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const prices: Record<string, any> = {};

    if (data.latest && Array.isArray(data.latest)) {
      data.latest.forEach((p: any) => {
        if (p.game_key) {
          prices[p.game_key] = {
            loose: p.loose_price_cents,
            cib: p.cib_price_cents,
            new: p.new_price_cents,
            currency: p.currency ?? "USD",
            snapshotDate: p.snapshot_date,
          };
        }
      });
    }

    return prices;
  } catch (error) {
    console.warn("Price data unavailable:", error);
    return {};
  }
}

/**
 * Check if sample mode is forced via URL or global flag
 */
function checkForceSampleMode(): boolean {
  if (typeof window === "undefined") return false;

  // Check global flag
  if ((window as any).__SANDGRAAL_FORCE_SAMPLE__) {
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
