import type {
  PriceData,
  PriceLoadResult,
  PricingOffers,
  PricingSource,
  RegionalOffer,
} from "../core/types";

const LIVE_PRICE_ENDPOINTS = [
  "/api/v1/prices/latest",
  "/api/prices/latest",
];

const PRICE_SNAPSHOT_PATH = "./data/sample-price-history.json";

/**
 * Load pricing from live endpoints or bundled snapshot
 */
export async function loadPrices(): Promise<PriceLoadResult> {
  const liveResult = await fetchLivePricing();
  if (liveResult) return liveResult;

  const snapshotResult = await fetchSnapshotPricing();
  if (snapshotResult) return snapshotResult;

  return {
    prices: {},
    source: "none",
    reason: "No pricing sources responded",
  };
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
    console.warn("Price snapshot unavailable:", error?.message ?? error);
  }
  return null;
}

function normalizeResponse(
  payload: any,
  source: PricingSource
): PriceLoadResult | null {
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

function normalizePriceEntry(
  entry: any,
  source: PricingSource
): PriceData | null {
  if (!entry) return null;

  const currency = entry.currency ?? entry.currency_code ?? "USD";
  const snapshotDate = entry.snapshot_date ?? entry.snapshotDate;
  const lastUpdated = entry.fetched_at ?? entry.last_updated ?? entry.lastUpdated;

  const priceData: PriceData = {
    loose: coerceNumber(
      entry.loose_price_cents ?? entry.loose ?? entry.loosePriceCents
    ),
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

function buildOffers(
  entry: any,
  currency: string,
  lastUpdated?: string
): PricingOffers {
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
