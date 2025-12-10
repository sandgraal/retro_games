import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadGames } from "../src/data/loader";
import * as supabaseModule from "../src/data/supabase";

const sampleGames = [
  {
    game_name: "Chrono Trigger",
    platform: "SNES",
    genre: "RPG",
    rating: "9.6",
    release_year: "1995",
  },
];

const supabaseGames = [
  {
    game_name: "Supabase Title",
    platform: "PS1",
    genre: "Action",
    rating: "9.1",
    release_year: "1998",
  },
];

const originalFetch = global.fetch;

function mockFetchWithData(data: unknown) {
  const response = new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
  return vi.fn(async () => response.clone());
}

describe("data loader", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (window as any).__SUPABASE_CONFIG__ = {
      url: "https://example.supabase.co",
      anonKey: "anon",
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
    delete (window as any).__SUPABASE_CONFIG__;
    delete (window as any).supabase;
    delete (window as any).__SANDGRAAL_FORCE_SAMPLE__;
  });

  it("returns Supabase data when client and data are available", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("sample should not load"));
    vi.stubGlobal("fetch", fetchMock);

    vi.spyOn(supabaseModule, "waitForSupabaseReady").mockResolvedValue(true);
    vi.spyOn(supabaseModule, "fetchGames").mockResolvedValue(supabaseGames as any);

    const result = await loadGames();

    expect(result.source).toBe("supabase");
    expect(result.games).toEqual(supabaseGames);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.reason).toBeUndefined();
  });

  it("falls back to sample data when Supabase is not ready", async () => {
    vi.spyOn(supabaseModule, "waitForSupabaseReady").mockResolvedValue(false);
    vi.spyOn(supabaseModule, "fetchGames").mockResolvedValue([] as any);

    const fetchMock = mockFetchWithData(sampleGames);
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadGames();

    expect(result.source).toBe("sample");
    expect(result.games).toEqual(sampleGames);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.reason).toContain("timeout");
  });

  it("falls back to sample data when Supabase returns no rows", async () => {
    vi.spyOn(supabaseModule, "waitForSupabaseReady").mockResolvedValue(true);
    vi.spyOn(supabaseModule, "fetchGames").mockResolvedValue([] as any);

    const fetchMock = mockFetchWithData(sampleGames);
    vi.stubGlobal("fetch", fetchMock);

    const result = await loadGames();

    expect(result.source).toBe("sample");
    expect(result.games).toEqual(sampleGames);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.reason).toContain("no games");
  });

  it("honors forced sample mode flag", async () => {
    (window as any).__SANDGRAAL_FORCE_SAMPLE__ = true;

    const fetchMock = mockFetchWithData(sampleGames);
    vi.stubGlobal("fetch", fetchMock);

    vi.spyOn(supabaseModule, "waitForSupabaseReady").mockResolvedValue(true);
    vi.spyOn(supabaseModule, "fetchGames").mockResolvedValue([] as any);

    const result = await loadGames();

    expect(result.source).toBe("sample");
    expect(result.reason).toContain("forced");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
