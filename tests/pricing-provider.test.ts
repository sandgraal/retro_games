import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPrices } from "../src/data/pricing-provider";

const originalFetch = global.fetch;

function mockResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("pricing provider", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("prefers live pricing endpoints when available", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        mockResponse({
          prices: {
            "Chrono Trigger___SNES": {
              loose_price_cents: 12300,
              currency: "USD",
              last_updated: "2025-01-05T12:00:00Z",
            },
          },
          last_updated: "2025-01-05T12:00:00Z",
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await loadPrices();

    expect(result.source).toBe("live");
    expect(result.lastUpdated).toBe("2025-01-05T12:00:00Z");
    expect(result.prices["Chrono Trigger___SNES"].loose).toBe(12300);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to bundled snapshot when live endpoints fail", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValue(
        mockResponse({
          latest: [
            {
              game_key: "Sample Game___NES",
              loose_price_cents: 5500,
              currency: "USD",
              snapshot_date: "2025-02-01",
            },
          ],
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await loadPrices();

    expect(result.source).toBe("snapshot");
    expect(result.lastUpdated).toBe("2025-02-01");
    expect(result.prices["Sample Game___NES"].loose).toBe(5500);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("gracefully reports missing pricing sources", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("missing"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadPrices();

    expect(result.source).toBe("none");
    expect(result.prices).toEqual({});
  });

  it("tries second live endpoint when first returns non-ok status", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResponse({}, 404)) // First endpoint fails
      .mockResolvedValueOnce(
        mockResponse({
          prices: {
            "Final Fantasy VII___PS1": {
              loose_price_cents: 8900,
              currency: "USD",
              last_updated: "2025-01-10T10:30:00Z",
            },
          },
          last_updated: "2025-01-10T10:30:00Z",
        })
      ); // Second endpoint succeeds

    vi.stubGlobal("fetch", fetchMock);

    const result = await loadPrices();

    expect(result.source).toBe("live");
    expect(result.lastUpdated).toBe("2025-01-10T10:30:00Z");
    expect(result.prices["Final Fantasy VII___PS1"].loose).toBe(8900);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("normalizes different field name variants (loose_price_cents, loose, loosePriceCents)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        mockResponse({
          prices: {
            "Game A___SNES": {
              loose_price_cents: 1000,
              cib: 2000,
              newPriceCents: 3000,
              currency: "USD",
            },
            "Game B___NES": {
              loose: 1500,
              cib_price_cents: 2500,
              new: 3500,
              currency: "USD",
            },
            "Game C___Genesis": {
              loosePriceCents: 2000,
              cibPriceCents: 3000,
              new_price_cents: 4000,
              currency: "USD",
            },
          },
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await loadPrices();

    expect(result.source).toBe("live");
    expect(result.prices["Game A___SNES"].loose).toBe(1000);
    expect(result.prices["Game A___SNES"].cib).toBe(2000);
    expect(result.prices["Game A___SNES"].new).toBe(3000);
    expect(result.prices["Game B___NES"].loose).toBe(1500);
    expect(result.prices["Game B___NES"].cib).toBe(2500);
    expect(result.prices["Game B___NES"].new).toBe(3500);
    expect(result.prices["Game C___Genesis"].loose).toBe(2000);
    expect(result.prices["Game C___Genesis"].cib).toBe(3000);
    expect(result.prices["Game C___Genesis"].new).toBe(4000);
  });

  it("extracts regional offer data with buildOffers", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        mockResponse({
          prices: {
            "Super Mario 64___N64": {
              loose_price_cents: 5500,
              cib_price_cents: 12000,
              new_price_cents: 25000,
              currency: "USD",
              region: "US",
              retailer: "GameStop",
              url: "https://example.com/mario64",
              last_updated: "2025-01-15T14:00:00Z",
            },
          },
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await loadPrices();

    expect(result.source).toBe("live");
    const priceData = result.prices["Super Mario 64___N64"];
    expect(priceData.offers).toBeDefined();
    expect(priceData.offers?.US).toBeDefined();
    expect(priceData.offers?.US.length).toBe(3);
    
    const looseOffer = priceData.offers?.US.find(o => o.condition === "loose");
    expect(looseOffer).toBeDefined();
    expect(looseOffer?.amountCents).toBe(5500);
    expect(looseOffer?.currency).toBe("USD");
    expect(looseOffer?.retailer).toBe("GameStop");
    expect(looseOffer?.url).toBe("https://example.com/mario64");
    
    const cibOffer = priceData.offers?.US.find(o => o.condition === "cib");
    expect(cibOffer?.amountCents).toBe(12000);
    
    const newOffer = priceData.offers?.US.find(o => o.condition === "new");
    expect(newOffer?.amountCents).toBe(25000);
  });

  it("returns null from normalizeResponse for invalid payload structure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockResponse(null) // Invalid: null payload
      )
      .mockResolvedValueOnce(
        mockResponse({ randomKey: "value" }) // Invalid: no prices or latest
      )
      .mockResolvedValueOnce(
        mockResponse({
          latest: [
            {
              game_key: "Fallback Game___SNES",
              loose_price_cents: 3000,
              currency: "USD",
              snapshot_date: "2025-02-05",
            },
          ],
        })
      ); // Valid snapshot

    vi.stubGlobal("fetch", fetchMock);

    const result = await loadPrices();

    // Should fall through invalid responses and use snapshot
    expect(result.source).toBe("snapshot");
    expect(result.prices["Fallback Game___SNES"].loose).toBe(3000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("handles missing game_key in snapshot entries gracefully", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValue(
        mockResponse({
          latest: [
            {
              // Missing game_key
              loose_price_cents: 1000,
              currency: "USD",
            },
            {
              game_key: "Valid Game___NES",
              loose_price_cents: 2000,
              currency: "USD",
              snapshot_date: "2025-02-10",
            },
          ],
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await loadPrices();

    expect(result.source).toBe("snapshot");
    expect(result.prices["Valid Game___NES"]).toBeDefined();
    expect(result.prices["Valid Game___NES"].loose).toBe(2000);
    // Entry without game_key should be skipped
    expect(Object.keys(result.prices).length).toBe(1);
  });

  it("builds offers with alternative field names (country, vendor, store_url)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        mockResponse({
          prices: {
            "Pokemon Red___GB": {
              loose_price_cents: 4500,
              currency: "USD",
              country: "UK", // Alternative to "region"
              vendor: "RetroStore", // Alternative to "retailer"
              store_url: "https://example.com/pokemon", // Alternative to "url"
              fetched_at: "2025-01-20T09:00:00Z",
            },
          },
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await loadPrices();

    expect(result.source).toBe("live");
    const priceData = result.prices["Pokemon Red___GB"];
    expect(priceData.offers).toBeDefined();
    expect(priceData.offers?.UK).toBeDefined();
    
    const looseOffer = priceData.offers?.UK.find(o => o.condition === "loose");
    expect(looseOffer?.retailer).toBe("RetroStore");
    expect(looseOffer?.url).toBe("https://example.com/pokemon");
  });
});
