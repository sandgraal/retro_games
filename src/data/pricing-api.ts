/**
 * Pricing API Client
 *
 * Fetches pricing data from Supabase Edge Functions or direct database queries.
 * Supports price history, trends, bulk lookups, and marketplace listings.
 */

import type { PriceData, PricingSource } from "../core/types";
import { getConfig } from "./supabase";

// API response types
export interface PriceSnapshot {
  game_key: string;
  game_name: string;
  platform: string;
  loose_price_cents: number | null;
  cib_price_cents: number | null;
  new_price_cents: number | null;
  snapshot_date: string;
  source: string;
  currency: string;
  region_code?: string;
}

export interface PriceHistoryPoint {
  snapshot_date: string;
  loose_price_cents: number | null;
  cib_price_cents: number | null;
  new_price_cents: number | null;
  source: string;
}

export interface PriceTrends {
  game_key: string;
  current_loose: number | null;
  current_cib: number | null;
  current_new: number | null;
  week_change_pct: number | null;
  month_change_pct: number | null;
  quarter_change_pct: number | null;
  year_change_pct: number | null;
  all_time_high_loose: number | null;
  all_time_low_loose: number | null;
  snapshot_count: number;
}

export interface GamePriceDetails {
  game_key: string;
  current: PriceSnapshot | null;
  history: PriceHistoryPoint[];
  trends: PriceTrends | null;
}

export interface MarketplaceStats {
  active_listings: number;
  active_sellers: number;
  for_sale: number;
  for_trade: number;
  wanted: number;
  pending_trades: number;
  transactions_30d: number;
  volume_30d_cents: number;
  prices_updated_today: number;
}

export interface ListingSummary {
  id: string;
  game_key: string;
  title: string;
  asking_price_cents: number | null;
  currency: string;
  condition: string;
  listing_type: "sale" | "trade" | "auction" | "wanted";
  is_complete_in_box: boolean;
  photos: string[];
  city: string | null;
  country_code: string | null;
  created_at: string;
  view_count: number;
  favorite_count: number;
  seller_name?: string;
  seller_avatar?: string;
}

// Caching layer
const priceCache = new Map<string, { data: PriceSnapshot; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedPrice(gameKey: string): PriceSnapshot | null {
  const cached = priceCache.get(gameKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  return null;
}

function setCachedPrice(gameKey: string, data: PriceSnapshot): void {
  priceCache.set(gameKey, { data, timestamp: Date.now() });
}

/**
 * Get the base URL for pricing API calls
 */
function getApiBaseUrl(): string {
  const config = getConfig();
  if (config?.url) {
    return `${config.url.replace(/\/$/, "")}/functions/v1`;
  }
  // Fallback to relative path for local dev
  return "/api";
}

/**
 * Build headers for API requests
 */
function getApiHeaders(): Record<string, string> {
  const config = getConfig();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config?.anonKey) {
    headers["apikey"] = config.anonKey;
    headers["Authorization"] = `Bearer ${config.anonKey}`;
  }
  return headers;
}

/**
 * Fetch latest prices for all games (paginated)
 */
export async function fetchLatestPrices(options?: {
  platform?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  prices: PriceSnapshot[];
  pagination: { limit: number; offset: number; count: number };
}> {
  const baseUrl = getApiBaseUrl();
  const params = new URLSearchParams();

  if (options?.platform) params.set("platform", options.platform);
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.offset) params.set("offset", String(options.offset));

  const url = `${baseUrl}/pricing/latest${params.toString() ? `?${params}` : ""}`;

  try {
    const response = await fetch(url, { headers: getApiHeaders() });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const result = await response.json();

    // Cache each price
    for (const price of result.prices || []) {
      setCachedPrice(price.game_key, price);
    }

    return result;
  } catch (error) {
    console.error("Failed to fetch latest prices:", error);
    return { prices: [], pagination: { limit: 100, offset: 0, count: 0 } };
  }
}

/**
 * Get detailed price info for a specific game including history and trends
 */
export async function fetchGamePrice(
  gameKey: string,
  options?: { days?: number; region?: string }
): Promise<GamePriceDetails | null> {
  const baseUrl = getApiBaseUrl();
  const params = new URLSearchParams();

  if (options?.days) params.set("days", String(options.days));
  if (options?.region) params.set("region", options.region);

  const url = `${baseUrl}/pricing/game/${encodeURIComponent(gameKey)}${params.toString() ? `?${params}` : ""}`;

  try {
    const response = await fetch(url, { headers: getApiHeaders() });
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`API error: ${response.status}`);
    }
    const result = await response.json();

    // Cache the current price
    if (result.current) {
      setCachedPrice(gameKey, result.current);
    }

    return result;
  } catch (error) {
    console.error(`Failed to fetch price for ${gameKey}:`, error);
    return null;
  }
}

/**
 * Get prices for multiple games at once (bulk lookup)
 */
export async function fetchBulkPrices(
  gameKeys: string[]
): Promise<Record<string, PriceSnapshot>> {
  if (gameKeys.length === 0) return {};

  // Check cache first
  const result: Record<string, PriceSnapshot> = {};
  const uncached: string[] = [];

  for (const key of gameKeys) {
    const cached = getCachedPrice(key);
    if (cached) {
      result[key] = cached;
    } else {
      uncached.push(key);
    }
  }

  if (uncached.length === 0) {
    return result;
  }

  // Fetch uncached prices in batches of 50
  const baseUrl = getApiBaseUrl();
  const batches = [];
  for (let i = 0; i < uncached.length; i += 50) {
    batches.push(uncached.slice(i, i + 50));
  }

  await Promise.all(
    batches.map(async (batch) => {
      const url = `${baseUrl}/pricing/bulk?keys=${batch.map(encodeURIComponent).join(",")}`;
      try {
        const response = await fetch(url, { headers: getApiHeaders() });
        if (response.ok) {
          const data = await response.json();
          for (const [key, price] of Object.entries(data.prices || {})) {
            result[key] = price as PriceSnapshot;
            setCachedPrice(key, price as PriceSnapshot);
          }
        }
      } catch (error) {
        console.error("Bulk price fetch failed:", error);
      }
    })
  );

  return result;
}

/**
 * Search games with prices by name
 */
export async function searchPrices(query: string, limit = 20): Promise<PriceSnapshot[]> {
  if (query.length < 2) return [];

  const baseUrl = getApiBaseUrl();
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const url = `${baseUrl}/pricing/search?${params}`;

  try {
    const response = await fetch(url, { headers: getApiHeaders() });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const result = await response.json();
    return result.results || [];
  } catch (error) {
    console.error("Price search failed:", error);
    return [];
  }
}

/**
 * Get marketplace statistics
 */
export async function fetchMarketplaceStats(): Promise<MarketplaceStats | null> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/pricing/stats`;

  try {
    const response = await fetch(url, { headers: getApiHeaders() });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch marketplace stats:", error);
    return null;
  }
}

/**
 * Get listings for a specific game
 */
export async function fetchGameListings(
  gameKey: string,
  options?: {
    type?: "sale" | "trade" | "wanted";
    maxPrice?: number;
    conditions?: string[];
  }
): Promise<ListingSummary[]> {
  const baseUrl = getApiBaseUrl();
  const params = new URLSearchParams();

  if (options?.type) params.set("type", options.type);
  if (options?.maxPrice) params.set("max_price", String(options.maxPrice));
  if (options?.conditions?.length) params.set("conditions", options.conditions.join(","));

  const url = `${baseUrl}/listings/game/${encodeURIComponent(gameKey)}${params.toString() ? `?${params}` : ""}`;

  try {
    const response = await fetch(url, { headers: getApiHeaders() });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const result = await response.json();
    return result.listings || [];
  } catch (error) {
    console.error(`Failed to fetch listings for ${gameKey}:`, error);
    return [];
  }
}

/**
 * Convert API price to internal PriceData format
 */
export function toPriceData(snapshot: PriceSnapshot): PriceData {
  return {
    loose: snapshot.loose_price_cents ?? undefined,
    cib: snapshot.cib_price_cents ?? undefined,
    new: snapshot.new_price_cents ?? undefined,
    currency: snapshot.currency,
    snapshotDate: snapshot.snapshot_date,
    lastUpdated: snapshot.snapshot_date,
    source: snapshot.source as PricingSource,
  };
}

/**
 * Format price in cents to display string
 */
export function formatPrice(cents: number | null | undefined, currency = "USD"): string {
  if (cents === null || cents === undefined) return "—";
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Format price change percentage
 */
export function formatPriceChange(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return "—";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

/**
 * Get CSS class for price change (positive/negative)
 */
export function getPriceChangeClass(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return "";
  if (pct > 0) return "price-up";
  if (pct < 0) return "price-down";
  return "price-stable";
}
