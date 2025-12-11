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
    const fetchMock = vi.fn().mockResolvedValue(
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
});
