import type {
  PriceData,
  PriceLoadResult,
  PricingOffers,
  PricingSource,
  RegionalOffer,
} from "../core/types";
import { getConfig } from "./supabase";

const LIVE_PRICE_ENDPOINTS = ["/api/v1/prices/latest", "/api/prices/latest"];

const PRICE_SNAPSHOT_PATH = "./data/sample-price-history.json";

/**
 * Load pricing from Supabase, live endpoints, or bundled snapshot
 * Priority: Supabase > Live API > Local Snapshot
 */
export async function loadPrices(): Promise<PriceLoadResult> {
  // Try Supabase first (primary source)
  const supabaseResult = await fetchSupabasePricing();
  if (supabaseResult) return supabaseResult;

  // Fall back to live endpoints
  const liveResult = await fetchLivePricing();
  if (liveResult) return liveResult;

  // Fall back to bundled snapshot
  const snapshotResult = await fetchSnapshotPricing();
  if (snapshotResult) return snapshotResult;

  return {
    prices: {},
    source: "none",
    reason: "No pricing sources responded",
  };
}

/**
 * Fetch latest prices from Supabase game_price_trends view (includes trend data)
 */
async function fetchSupabasePricing(): Promise<PriceLoadResult | null> {
  const config = getConfig();
  if (!config?.url || !config?.anonKey) {
    console.warn("Supabase not configured, skipping pricing fetch");
    return null;
  }

  try {
    // Use game_price_trends view which includes trend data
    const url = `${config.url.replace(/\/$/, "")}/rest/v1/game_price_trends?select=*`;
    const response = await fetch(url, {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.warn(`Supabase pricing fetch failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      console.info("No pricing data in Supabase yet");
      return null;
    }

    const prices: Record<string, PriceData> = {};
    let newestTimestamp: string | undefined;

    for (const row of data) {
      if (!row?.game_key) continue;
      const normalized = normalizePriceEntry(row, "live");
      if (normalized) {
        // Add trend data
        normalized.weekChangePct = parseFloat(row.week_change_pct) || undefined;
        normalized.monthChangePct = parseFloat(row.month_change_pct) || undefined;
        normalized.allTimeLow = row.all_time_low_loose || undefined;
        normalized.allTimeHigh = row.all_time_high_loose || undefined;

        prices[row.game_key] = normalized;
        const candidate = normalized.lastUpdated ?? normalized.snapshotDate;
        if (candidate && (!newestTimestamp || candidate > newestTimestamp)) {
          newestTimestamp = candidate;
        }
      }
    }

    console.info(`Loaded ${Object.keys(prices).length} prices with trends from Supabase`);
    return {
      prices,
      source: "live",
      lastUpdated: newestTimestamp,
    };
  } catch (error) {
    console.warn(
      "Supabase pricing fetch error:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

async function fetchLivePricing(): Promise<PriceLoadResult | null> {
  for (const endpoint of LIVE_PRICE_ENDPOINTS) {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) continue;

      const payload = await response.json();
      const normalized = normalizeResponse(payload, "live");
      if (normalized) {
        return normalized;
      }
    } catch (error) {
      console.warn(
        `Live pricing fetch failed for ${endpoint}: ${error && typeof error === "object" && "message" in error ? (error as Error).message : String(error)}`
      );
    }
  }
  return null;
}

async function fetchSnapshotPricing(): Promise<PriceLoadResult | null> {
  try {
    const response = await fetch(PRICE_SNAPSHOT_PATH);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    const normalized = normalizeResponse(payload, "snapshot");
    if (normalized) return normalized;
  } catch (error) {
    console.warn(
      "Price snapshot unavailable:",
      error instanceof Error ? error.message : String(error)
    );
  }
  return null;
}

function normalizeResponse(payload: any, source: PricingSource): PriceLoadResult | null {
  if (!payload) return null;

  // Direct map shape { prices: { key: PriceData }, last_updated }
  if (payload.prices && typeof payload.prices === "object") {
    return {
      prices: mapPriceEntries(payload.prices, source),
      source,
      lastUpdated: payload.last_updated ?? payload.lastUpdated,
      reason: payload.reason,
    };
  }

  // Snapshot shape { latest: [ ... ] }
  if (Array.isArray(payload.latest)) {
    const prices: Record<string, PriceData> = {};
    let newestTimestamp: string | undefined;

    payload.latest.forEach((entry: any) => {
      if (!entry?.game_key) return;
      const normalized = normalizePriceEntry(entry, source);
      if (normalized) {
        prices[entry.game_key] = normalized;
        const candidate = normalized.lastUpdated ?? normalized.snapshotDate;
        if (candidate && (!newestTimestamp || candidate > newestTimestamp)) {
          newestTimestamp = candidate;
        }
      }
    });

    return {
      prices,
      source,
      lastUpdated: newestTimestamp,
    };
  }

  return null;
}

function mapPriceEntries(
  entries: Record<string, any>,
  source: PricingSource
): Record<string, PriceData> {
  return Object.entries(entries).reduce<Record<string, PriceData>>(
    (acc, [key, value]) => {
      const normalized = normalizePriceEntry(value, source);
      if (normalized) {
        acc[key] = normalized;
      }
      return acc;
    },
    {}
  );
}

function normalizePriceEntry(entry: any, source: PricingSource): PriceData | null {
  if (!entry) return null;

  const currency = entry.currency ?? entry.currency_code ?? "USD";
  const snapshotDate = entry.snapshot_date ?? entry.snapshotDate;
  const lastUpdated = entry.fetched_at ?? entry.last_updated ?? entry.lastUpdated;

  const priceData: PriceData = {
    loose: coerceNumber(entry.loose_price_cents ?? entry.loose ?? entry.loosePriceCents),
    cib: coerceNumber(entry.cib_price_cents ?? entry.cib ?? entry.cibPriceCents),
    new: coerceNumber(entry.new_price_cents ?? entry.new ?? entry.newPriceCents),
    currency,
    snapshotDate,
    lastUpdated,
    source,
  };

  const offers = buildOffers(entry, currency, lastUpdated ?? snapshotDate);
  if (Object.keys(offers).length > 0) {
    priceData.offers = offers;
  }

  return priceData;
}

function buildOffers(entry: any, currency: string, lastUpdated?: string): PricingOffers {
  const offers: PricingOffers = {};
  const region = entry.region ?? entry.country ?? "global";
  const retailer = entry.retailer ?? entry.source ?? entry.vendor ?? undefined;
  const url = entry.url ?? entry.store_url ?? entry.product_url ?? undefined;

  const conditions: Array<{
    key: string;
    label: string;
    condition: RegionalOffer["condition"];
  }> = [
    { key: "loose_price_cents", label: "Loose", condition: "loose" },
    { key: "cib_price_cents", label: "Complete", condition: "cib" },
    { key: "new_price_cents", label: "New", condition: "new" },
  ];

  conditions.forEach(({ key, label, condition }) => {
    const amount = coerceNumber(entry[key] ?? entry[condition as string]);
    if (amount === undefined) return;

    const offer: RegionalOffer = {
      amountCents: amount,
      currency,
      label,
      condition,
      retailer,
      url,
      lastUpdated,
    };

    if (!offers[region]) {
      offers[region] = [];
    }
    offers[region].push(offer);
  });

  return offers;
}

function coerceNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

/**
 * Price history point for charting
 */
export interface PriceHistoryPoint {
  date: string;
  loose: number | null;
  cib: number | null;
  newPrice: number | null;
}

/**
 * Fetch price history for a game from Supabase
 */
export async function fetchPriceHistory(
  gameKey: string,
  days = 90
): Promise<PriceHistoryPoint[]> {
  const config = getConfig();
  if (!config?.url || !config?.anonKey) {
    return [];
  }

  try {
    const url = `${config.url.replace(/\/$/, "")}/rest/v1/rpc/get_price_history`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_game_key: gameKey,
        p_days: days,
      }),
    });

    if (!response.ok) {
      console.warn(`Price history fetch failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data.map((row) => ({
      date: row.snapshot_date,
      loose: row.loose_price_cents ?? null,
      cib: row.cib_price_cents ?? null,
      newPrice: row.new_price_cents ?? null,
    }));
  } catch (error) {
    console.warn(
      "Price history fetch error:",
      error instanceof Error ? error.message : String(error)
    );
    return [];
  }
}
