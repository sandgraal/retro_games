/**
 * Platform Import Features
 * Import game libraries from Steam, Xbox, PlayStation, Nintendo, and third-party services
 */

import type { CollectionStatus, GameWithKey } from "../core/types";
import { games } from "../state/store";

// === Types ===

export type ImportSource =
  | "steam"
  | "xbox"
  | "playstation"
  | "nintendo"
  | "backloggd"
  | "ggdeals"
  | "howlongtobeat"
  | "exophase"
  | "grouvee"
  | "rawg"
  | "csv";

export interface ImportedGame {
  name: string;
  platform: string;
  source: ImportSource;
  externalId?: string;
  playtime?: number; // minutes
  completed?: boolean;
  achievements?: {
    earned: number;
    total: number;
  };
  status?: CollectionStatus;
  lastPlayed?: string;
  rating?: number;
}

export interface ImportMatch {
  imported: ImportedGame;
  matched: GameWithKey | null;
  confidence: number; // 0-1
  alternativeMatches?: GameWithKey[];
}

export interface ImportResult {
  source: ImportSource;
  total: number;
  matched: number;
  unmatched: number;
  matches: ImportMatch[];
  errors: string[];
}

// === Platform Mappings ===

// Steam platform mapping (used internally by Steam API integration)
export const STEAM_PLATFORM_MAP: Record<string, string> = {
  windows: "PC",
  mac: "PC",
  linux: "PC",
};

const PLAYSTATION_PLATFORM_MAP: Record<string, string> = {
  ps5: "PS5",
  ps4: "PS4",
  ps3: "PS3",
  ps2: "PS2",
  ps1: "PS1",
  psx: "PS1",
  psvita: "Vita",
  psp: "PSP",
};

const XBOX_PLATFORM_MAP: Record<string, string> = {
  xboxseriesx: "Xbox Series X",
  xboxone: "Xbox One",
  xbox360: "Xbox 360",
  xbox: "Xbox",
};

const NINTENDO_PLATFORM_MAP: Record<string, string> = {
  switch: "Switch",
  wiiu: "Wii U",
  wii: "Wii",
  "3ds": "3DS",
  ds: "DS",
  gamecube: "GameCube",
  n64: "N64",
  snes: "SNES",
  nes: "NES",
  gameboy: "Game Boy",
  gba: "GBA",
};

// === Fuzzy Matching ===

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Normalize game name for matching
 */
function normalizeGameName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/[:–—-]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b(the|a|an)\b/gi, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

/**
 * Calculate match confidence between two game names
 */
function calculateMatchConfidence(importedName: string, catalogName: string): number {
  const normalizedImported = normalizeGameName(importedName);
  const normalizedCatalog = normalizeGameName(catalogName);

  // Exact match
  if (normalizedImported === normalizedCatalog) {
    return 1.0;
  }

  // Contains match
  if (
    normalizedImported.includes(normalizedCatalog) ||
    normalizedCatalog.includes(normalizedImported)
  ) {
    return 0.9;
  }

  // Levenshtein similarity
  const maxLen = Math.max(normalizedImported.length, normalizedCatalog.length);
  const distance = levenshteinDistance(normalizedImported, normalizedCatalog);

  return 1 - distance / maxLen;
}

/**
 * Find best matching game in catalog
 */
export function findBestMatch(imported: ImportedGame, threshold = 0.7): ImportMatch {
  const catalog = games.get();
  let bestMatch: GameWithKey | null = null;
  let bestConfidence = 0;
  const alternatives: GameWithKey[] = [];

  // Normalize platform for matching
  const targetPlatform = imported.platform?.toLowerCase();

  for (const game of catalog) {
    const gamePlatform = game.platform?.toLowerCase();

    // Calculate name confidence
    const nameConfidence = calculateMatchConfidence(imported.name, game.game_name);

    // Boost confidence if platform matches
    let platformBoost = 0;
    if (targetPlatform && gamePlatform) {
      if (gamePlatform === targetPlatform) {
        platformBoost = 0.1;
      } else if (
        gamePlatform.includes(targetPlatform) ||
        targetPlatform.includes(gamePlatform)
      ) {
        platformBoost = 0.05;
      }
    }

    const totalConfidence = Math.min(1, nameConfidence + platformBoost);

    if (totalConfidence >= threshold) {
      if (totalConfidence > bestConfidence) {
        if (bestMatch) {
          alternatives.push(bestMatch);
        }
        bestMatch = game;
        bestConfidence = totalConfidence;
      } else if (totalConfidence > threshold) {
        alternatives.push(game);
      }
    }
  }

  return {
    imported,
    matched: bestMatch,
    confidence: bestConfidence,
    alternativeMatches: alternatives.slice(0, 5),
  };
}

// === Steam Import ===

interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  playtime_2weeks?: number;
  img_icon_url?: string;
  has_community_visible_stats?: boolean;
}

interface SteamOwnedGamesResponse {
  response: {
    game_count: number;
    games: SteamGame[];
  };
}

/**
 * Parse Steam ID from various formats
 * Supports: 64-bit ID, vanity URL, profile URL
 */
export function parseSteamId(input: string): string | null {
  const trimmed = input.trim();

  // Already a 64-bit ID (17 digits starting with 7656119)
  if (/^7656119\d{10}$/.test(trimmed)) {
    return trimmed;
  }

  // Profile URL with 64-bit ID
  const profileMatch = trimmed.match(/steamcommunity\.com\/profiles\/(\d{17})/);
  if (profileMatch) {
    return profileMatch[1];
  }

  // Vanity URL - needs resolution (return as-is, will be resolved later)
  const vanityMatch = trimmed.match(/steamcommunity\.com\/id\/([a-zA-Z0-9_-]+)/);
  if (vanityMatch) {
    return `vanity:${vanityMatch[1]}`;
  }

  // Plain vanity name
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed) && trimmed.length <= 32) {
    return `vanity:${trimmed}`;
  }

  return null;
}

/**
 * Fetch Steam library via proxy
 * Note: Requires CORS proxy or Supabase Edge Function
 */
export async function fetchSteamLibrary(
  steamId: string,
  proxyUrl?: string
): Promise<ImportResult> {
  const errors: string[] = [];
  const matches: ImportMatch[] = [];

  try {
    // Resolve vanity URL if needed
    let resolvedId = steamId;
    if (steamId.startsWith("vanity:")) {
      const vanityName = steamId.slice(7);
      const resolveUrl = proxyUrl
        ? `${proxyUrl}/steam/resolve-vanity?vanityurl=${vanityName}`
        : `/api/steam/resolve-vanity?vanityurl=${vanityName}`;

      const resolveResponse = await fetch(resolveUrl);
      if (!resolveResponse.ok) {
        throw new Error(`Failed to resolve Steam vanity URL: ${vanityName}`);
      }
      const resolveData = await resolveResponse.json();
      if (resolveData.response?.success !== 1) {
        throw new Error(`Steam vanity URL not found: ${vanityName}`);
      }
      resolvedId = resolveData.response.steamid;
    }

    // Fetch owned games
    const apiUrl = proxyUrl
      ? `${proxyUrl}/steam/owned-games?steamid=${resolvedId}`
      : `/api/steam/owned-games?steamid=${resolvedId}`;

    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch Steam library: ${response.statusText}`);
    }

    const data: SteamOwnedGamesResponse = await response.json();

    if (!data.response?.games) {
      throw new Error(
        "Steam profile may be private. Please set your game details to public."
      );
    }

    // Convert to ImportedGame and match
    for (const steamGame of data.response.games) {
      const imported: ImportedGame = {
        name: steamGame.name,
        platform: "PC",
        source: "steam",
        externalId: String(steamGame.appid),
        playtime: steamGame.playtime_forever,
        status: "owned",
      };

      const match = findBestMatch(imported);
      matches.push(match);
    }

    return {
      source: "steam",
      total: data.response.game_count,
      matched: matches.filter((m) => m.matched !== null).length,
      unmatched: matches.filter((m) => m.matched === null).length,
      matches,
      errors,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Unknown error");
    return {
      source: "steam",
      total: 0,
      matched: 0,
      unmatched: 0,
      matches: [],
      errors,
    };
  }
}

// === Third-Party Service Imports ===

// --- Backloggd ---

/**
 * Parse Backloggd export (CSV format)
 * Users can export from: backloggd.com/u/{username}/export
 */
export function parseBackloggdExport(csvContent: string): ImportResult {
  const errors: string[] = [];
  const matches: ImportMatch[] = [];

  try {
    const lines = csvContent.split("\n").filter((l) => l.trim());
    const headers = lines[0]
      ?.toLowerCase()
      .split(",")
      .map((h) => h.trim());

    if (!headers?.includes("name") || !headers?.includes("platform")) {
      errors.push(
        "Invalid Backloggd CSV format. Expected 'name' and 'platform' columns."
      );
      return { source: "backloggd", total: 0, matched: 0, unmatched: 0, matches, errors };
    }

    const nameIdx = headers.indexOf("name");
    const platformIdx = headers.indexOf("platform");
    const statusIdx = headers.indexOf("status");
    const ratingIdx = headers.indexOf("rating");

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length <= nameIdx) continue;

      const backloggdStatus = values[statusIdx]?.toLowerCase() || "";
      let status: CollectionStatus = "owned";
      if (backloggdStatus.includes("wishlist")) status = "wishlist";
      else if (backloggdStatus.includes("backlog")) status = "backlog";

      const imported: ImportedGame = {
        name: values[nameIdx],
        platform: values[platformIdx] || "Unknown",
        source: "backloggd",
        status,
        rating: ratingIdx >= 0 ? parseFloat(values[ratingIdx]) : undefined,
      };

      const match = findBestMatch(imported);
      matches.push(match);
    }

    return {
      source: "backloggd",
      total: matches.length,
      matched: matches.filter((m) => m.matched !== null).length,
      unmatched: matches.filter((m) => m.matched === null).length,
      matches,
      errors,
    };
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : "Failed to parse Backloggd export"
    );
    return { source: "backloggd", total: 0, matched: 0, unmatched: 0, matches, errors };
  }
}

// --- GG.deals ---

/**
 * Parse GG.deals collection export (CSV format)
 * Users can export from: gg.deals/us/collection/
 */
export function parseGGDealsExport(csvContent: string): ImportResult {
  const errors: string[] = [];
  const matches: ImportMatch[] = [];

  try {
    const lines = csvContent.split("\n").filter((l) => l.trim());
    const headers = lines[0]
      ?.toLowerCase()
      .split(",")
      .map((h) => h.trim());

    if (!headers?.includes("title") && !headers?.includes("name")) {
      errors.push("Invalid GG.deals CSV format.");
      return { source: "ggdeals", total: 0, matched: 0, unmatched: 0, matches, errors };
    }

    const nameIdx = headers.includes("title")
      ? headers.indexOf("title")
      : headers.indexOf("name");
    const statusIdx =
      headers.indexOf("list") >= 0 ? headers.indexOf("list") : headers.indexOf("status");

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length <= nameIdx) continue;

      const listName = values[statusIdx]?.toLowerCase() || "";
      let status: CollectionStatus = "owned";
      if (listName.includes("wishlist") || listName.includes("waitlist"))
        status = "wishlist";
      else if (listName.includes("backlog")) status = "backlog";

      const imported: ImportedGame = {
        name: values[nameIdx],
        platform: "PC", // GG.deals is primarily PC
        source: "ggdeals",
        status,
      };

      const match = findBestMatch(imported);
      matches.push(match);
    }

    return {
      source: "ggdeals",
      total: matches.length,
      matched: matches.filter((m) => m.matched !== null).length,
      unmatched: matches.filter((m) => m.matched === null).length,
      matches,
      errors,
    };
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : "Failed to parse GG.deals export"
    );
    return { source: "ggdeals", total: 0, matched: 0, unmatched: 0, matches, errors };
  }
}

// --- HowLongToBeat ---

/**
 * Parse HowLongToBeat export (JSON format)
 * Users need to use browser extension or manual export
 */
export function parseHLTBExport(jsonContent: string): ImportResult {
  const errors: string[] = [];
  const matches: ImportMatch[] = [];

  try {
    const data = JSON.parse(jsonContent);
    const gameList = Array.isArray(data) ? data : data.games || data.gamesList || [];

    for (const item of gameList) {
      const name = item.game_name || item.name || item.title;
      if (!name) continue;

      const imported: ImportedGame = {
        name,
        platform: item.platform || "Unknown",
        source: "howlongtobeat",
        externalId: item.game_id || item.id,
        playtime: item.comp_main || item.playtime,
        completed: item.comp_main > 0 || item.completed,
        status: item.comp_main > 0 ? "owned" : item.playing ? "backlog" : "owned",
      };

      const match = findBestMatch(imported);
      matches.push(match);
    }

    return {
      source: "howlongtobeat",
      total: matches.length,
      matched: matches.filter((m) => m.matched !== null).length,
      unmatched: matches.filter((m) => m.matched === null).length,
      matches,
      errors,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Failed to parse HLTB export");
    return {
      source: "howlongtobeat",
      total: 0,
      matched: 0,
      unmatched: 0,
      matches,
      errors,
    };
  }
}

// --- Grouvee ---

/**
 * Parse Grouvee export (CSV format)
 * Users can export from: grouvee.com/user/{username}/export/
 */
export function parseGrouveeExport(csvContent: string): ImportResult {
  const errors: string[] = [];
  const matches: ImportMatch[] = [];

  try {
    const lines = csvContent.split("\n").filter((l) => l.trim());
    const headers = lines[0]
      ?.toLowerCase()
      .split(",")
      .map((h) => h.trim());

    if (!headers?.includes("name")) {
      errors.push("Invalid Grouvee CSV format. Expected 'name' column.");
      return { source: "grouvee", total: 0, matched: 0, unmatched: 0, matches, errors };
    }

    const nameIdx = headers.indexOf("name");
    const platformIdx =
      headers.indexOf("platforms") >= 0
        ? headers.indexOf("platforms")
        : headers.indexOf("platform");
    const shelfIdx =
      headers.indexOf("shelves") >= 0
        ? headers.indexOf("shelves")
        : headers.indexOf("shelf");
    const ratingIdx = headers.indexOf("rating");

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length <= nameIdx) continue;

      const shelf = values[shelfIdx]?.toLowerCase() || "";
      let status: CollectionStatus = "owned";
      if (shelf.includes("wishlist") || shelf.includes("want")) status = "wishlist";
      else if (shelf.includes("backlog") || shelf.includes("queue")) status = "backlog";

      // Grouvee can have multiple platforms, take the first
      const platforms = values[platformIdx]?.split("|") || ["Unknown"];

      const imported: ImportedGame = {
        name: values[nameIdx],
        platform: platforms[0].trim(),
        source: "grouvee",
        status,
        rating: ratingIdx >= 0 ? parseFloat(values[ratingIdx]) : undefined,
      };

      const match = findBestMatch(imported);
      matches.push(match);
    }

    return {
      source: "grouvee",
      total: matches.length,
      matched: matches.filter((m) => m.matched !== null).length,
      unmatched: matches.filter((m) => m.matched === null).length,
      matches,
      errors,
    };
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : "Failed to parse Grouvee export"
    );
    return { source: "grouvee", total: 0, matched: 0, unmatched: 0, matches, errors };
  }
}

// --- ExoPhase ---

/**
 * Parse ExoPhase export (CSV format)
 * Users can export from: exophase.com/user/{username}/
 */
export function parseExophaseExport(csvContent: string): ImportResult {
  const errors: string[] = [];
  const matches: ImportMatch[] = [];

  try {
    const lines = csvContent.split("\n").filter((l) => l.trim());
    const headers = lines[0]
      ?.toLowerCase()
      .split(",")
      .map((h) => h.trim());

    const nameIdx =
      headers?.indexOf("game") >= 0
        ? headers.indexOf("game")
        : (headers?.indexOf("title") ?? 0);
    const platformIdx = headers?.indexOf("platform") ?? 1;
    const achievementIdx = headers?.indexOf("achievements") ?? -1;
    const completionIdx = headers?.indexOf("completion") ?? -1;

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length <= nameIdx) continue;

      // Map ExoPhase platform names
      let platform = values[platformIdx] || "Unknown";
      if (platform.toLowerCase().includes("playstation")) {
        platform =
          PLAYSTATION_PLATFORM_MAP[platform.toLowerCase().replace(/\s/g, "")] || platform;
      } else if (platform.toLowerCase().includes("xbox")) {
        platform =
          XBOX_PLATFORM_MAP[platform.toLowerCase().replace(/\s/g, "")] || platform;
      } else if (
        platform.toLowerCase().includes("nintendo") ||
        platform.toLowerCase().includes("switch")
      ) {
        platform =
          NINTENDO_PLATFORM_MAP[platform.toLowerCase().replace(/\s/g, "")] || platform;
      }

      const imported: ImportedGame = {
        name: values[nameIdx],
        platform,
        source: "exophase",
        status: "owned",
        achievements:
          achievementIdx >= 0 ? parseAchievements(values[achievementIdx]) : undefined,
        completed:
          completionIdx >= 0 ? parseFloat(values[completionIdx]) >= 100 : undefined,
      };

      const match = findBestMatch(imported);
      matches.push(match);
    }

    return {
      source: "exophase",
      total: matches.length,
      matched: matches.filter((m) => m.matched !== null).length,
      unmatched: matches.filter((m) => m.matched === null).length,
      matches,
      errors,
    };
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : "Failed to parse ExoPhase export"
    );
    return { source: "exophase", total: 0, matched: 0, unmatched: 0, matches, errors };
  }
}

// --- RAWG.io ---

/**
 * Parse RAWG collection export
 * Users can export their collection from rawg.io
 */
export function parseRAWGExport(jsonContent: string): ImportResult {
  const errors: string[] = [];
  const matches: ImportMatch[] = [];

  try {
    const data = JSON.parse(jsonContent);
    const gameList = Array.isArray(data) ? data : data.results || data.games || [];

    for (const item of gameList) {
      const name = item.name || item.title;
      if (!name) continue;

      // RAWG provides platforms as array
      const platforms = item.platforms?.map(
        (p: { platform: { name: string } }) => p.platform?.name
      ) || ["Unknown"];

      const imported: ImportedGame = {
        name,
        platform: platforms[0],
        source: "rawg",
        externalId: String(item.id),
        rating: item.rating,
        status: item.added_by_status?.owned
          ? "owned"
          : item.added_by_status?.toplay
            ? "backlog"
            : item.added_by_status?.wishlist
              ? "wishlist"
              : "owned",
      };

      const match = findBestMatch(imported);
      matches.push(match);
    }

    return {
      source: "rawg",
      total: matches.length,
      matched: matches.filter((m) => m.matched !== null).length,
      unmatched: matches.filter((m) => m.matched === null).length,
      matches,
      errors,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Failed to parse RAWG export");
    return { source: "rawg", total: 0, matched: 0, unmatched: 0, matches, errors };
  }
}

// --- PlayStation (PSNProfiles) ---

/**
 * Parse PSNProfiles game list export
 * Users need to manually export or use browser tools
 */
export function parsePSNProfilesExport(csvContent: string): ImportResult {
  const errors: string[] = [];
  const matches: ImportMatch[] = [];

  try {
    const lines = csvContent.split("\n").filter((l) => l.trim());
    const headers = lines[0]
      ?.toLowerCase()
      .split(",")
      .map((h) => h.trim());

    const nameIdx =
      headers?.indexOf("game") >= 0
        ? headers.indexOf("game")
        : (headers?.indexOf("title") ?? 0);
    const platformIdx = headers?.indexOf("platform") ?? 1;
    const trophyIdx = headers?.indexOf("trophies") ?? -1;

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length <= nameIdx) continue;

      let platform = values[platformIdx]?.trim() || "PlayStation";
      // Normalize PlayStation platform names
      const platformKey = platform.toLowerCase().replace(/\s/g, "");
      platform = PLAYSTATION_PLATFORM_MAP[platformKey] || platform;

      const imported: ImportedGame = {
        name: values[nameIdx],
        platform,
        source: "playstation",
        status: "owned",
        achievements: trophyIdx >= 0 ? parseAchievements(values[trophyIdx]) : undefined,
      };

      const match = findBestMatch(imported);
      matches.push(match);
    }

    return {
      source: "playstation",
      total: matches.length,
      matched: matches.filter((m) => m.matched !== null).length,
      unmatched: matches.filter((m) => m.matched === null).length,
      matches,
      errors,
    };
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : "Failed to parse PSNProfiles export"
    );
    return { source: "playstation", total: 0, matched: 0, unmatched: 0, matches, errors };
  }
}

// --- Xbox (TrueAchievements) ---

/**
 * Parse TrueAchievements game list export
 * Users can export from: trueachievements.com/gamer/{gamertag}/games
 */
export function parseTrueAchievementsExport(csvContent: string): ImportResult {
  const errors: string[] = [];
  const matches: ImportMatch[] = [];

  try {
    const lines = csvContent.split("\n").filter((l) => l.trim());
    const headers = lines[0]
      ?.toLowerCase()
      .split(",")
      .map((h) => h.trim());

    const nameIdx =
      headers?.indexOf("game") >= 0
        ? headers.indexOf("game")
        : (headers?.indexOf("title") ?? 0);
    const platformIdx = headers?.indexOf("platform") ?? -1;
    const achievementIdx = headers?.indexOf("achievements") ?? -1;
    // gamerscoreIdx available for future gamerscore tracking features
    void (headers?.indexOf("gamerscore") ?? -1);

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length <= nameIdx) continue;

      let platform = platformIdx >= 0 ? values[platformIdx]?.trim() : "Xbox";
      // Normalize Xbox platform names
      const platformKey = platform.toLowerCase().replace(/\s/g, "");
      platform = XBOX_PLATFORM_MAP[platformKey] || platform;

      const imported: ImportedGame = {
        name: values[nameIdx],
        platform,
        source: "xbox",
        status: "owned",
        achievements:
          achievementIdx >= 0 ? parseAchievements(values[achievementIdx]) : undefined,
      };

      const match = findBestMatch(imported);
      matches.push(match);
    }

    return {
      source: "xbox",
      total: matches.length,
      matched: matches.filter((m) => m.matched !== null).length,
      unmatched: matches.filter((m) => m.matched === null).length,
      matches,
      errors,
    };
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : "Failed to parse TrueAchievements export"
    );
    return { source: "xbox", total: 0, matched: 0, unmatched: 0, matches, errors };
  }
}

// --- Nintendo (Deku Deals) ---

/**
 * Parse Deku Deals wishlist/collection export
 * Users can export from: dekudeals.com/collection
 */
export function parseDekuDealsExport(csvContent: string): ImportResult {
  const errors: string[] = [];
  const matches: ImportMatch[] = [];

  try {
    const lines = csvContent.split("\n").filter((l) => l.trim());
    const headers = lines[0]
      ?.toLowerCase()
      .split(",")
      .map((h) => h.trim());

    const nameIdx =
      headers?.indexOf("title") >= 0
        ? headers.indexOf("title")
        : (headers?.indexOf("name") ?? 0);
    const listIdx = headers?.indexOf("list") ?? -1;

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length <= nameIdx) continue;

      const listName = listIdx >= 0 ? values[listIdx]?.toLowerCase() : "";
      let status: CollectionStatus = "owned";
      if (listName.includes("wishlist")) status = "wishlist";
      else if (listName.includes("backlog")) status = "backlog";

      const imported: ImportedGame = {
        name: values[nameIdx],
        platform: "Switch", // Deku Deals is Nintendo-focused
        source: "nintendo",
        status,
      };

      const match = findBestMatch(imported);
      matches.push(match);
    }

    return {
      source: "nintendo",
      total: matches.length,
      matched: matches.filter((m) => m.matched !== null).length,
      unmatched: matches.filter((m) => m.matched === null).length,
      matches,
      errors,
    };
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : "Failed to parse Deku Deals export"
    );
    return { source: "nintendo", total: 0, matched: 0, unmatched: 0, matches, errors };
  }
}

// === Generic CSV Import ===

/**
 * Parse generic CSV with column detection
 */
export function parseGenericCSV(csvContent: string): ImportResult {
  const errors: string[] = [];
  const matches: ImportMatch[] = [];

  try {
    const lines = csvContent.split("\n").filter((l) => l.trim());
    if (lines.length < 2) {
      errors.push("CSV file is empty or has no data rows.");
      return { source: "csv", total: 0, matched: 0, unmatched: 0, matches, errors };
    }

    const headers = lines[0]
      .toLowerCase()
      .split(",")
      .map((h) => h.trim());

    // Auto-detect column indices
    const nameIdx = findColumnIndex(headers, [
      "name",
      "title",
      "game",
      "game_name",
      "gamename",
    ]);
    const platformIdx = findColumnIndex(headers, ["platform", "system", "console"]);
    const statusIdx = findColumnIndex(headers, ["status", "list", "shelf", "collection"]);

    if (nameIdx === -1) {
      errors.push("Could not find 'name' or 'title' column in CSV.");
      return { source: "csv", total: 0, matched: 0, unmatched: 0, matches, errors };
    }

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length <= nameIdx || !values[nameIdx]?.trim()) continue;

      const statusValue = statusIdx >= 0 ? values[statusIdx]?.toLowerCase() : "";
      let status: CollectionStatus = "owned";
      if (statusValue.includes("wishlist") || statusValue.includes("want"))
        status = "wishlist";
      else if (statusValue.includes("backlog") || statusValue.includes("queue"))
        status = "backlog";
      else if (statusValue.includes("trade") || statusValue.includes("sell"))
        status = "trade";

      const imported: ImportedGame = {
        name: values[nameIdx].trim(),
        platform: platformIdx >= 0 ? values[platformIdx]?.trim() || "Unknown" : "Unknown",
        source: "csv",
        status,
      };

      const match = findBestMatch(imported);
      matches.push(match);
    }

    return {
      source: "csv",
      total: matches.length,
      matched: matches.filter((m) => m.matched !== null).length,
      unmatched: matches.filter((m) => m.matched === null).length,
      matches,
      errors,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Failed to parse CSV");
    return { source: "csv", total: 0, matched: 0, unmatched: 0, matches, errors };
  }
}

// === Utility Functions ===

function findColumnIndex(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.indexOf(candidate);
    if (idx >= 0) return idx;
  }
  // Fuzzy search
  for (let i = 0; i < headers.length; i++) {
    for (const candidate of candidates) {
      if (headers[i].includes(candidate) || candidate.includes(headers[i])) {
        return i;
      }
    }
  }
  return -1;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

function parseAchievements(value: string): { earned: number; total: number } | undefined {
  if (!value) return undefined;

  // Format: "50/100" or "50 of 100" or "50%"
  const slashMatch = value.match(/(\d+)\s*\/\s*(\d+)/);
  if (slashMatch) {
    return { earned: parseInt(slashMatch[1], 10), total: parseInt(slashMatch[2], 10) };
  }

  const ofMatch = value.match(/(\d+)\s*of\s*(\d+)/i);
  if (ofMatch) {
    return { earned: parseInt(ofMatch[1], 10), total: parseInt(ofMatch[2], 10) };
  }

  return undefined;
}

// === Auto-detect Import Format ===

/**
 * Auto-detect the source format and parse accordingly
 */
export function autoDetectAndParse(content: string, filename?: string): ImportResult {
  const lowerFilename = filename?.toLowerCase() || "";
  const lowerContent = content.toLowerCase().slice(0, 500);

  // Check filename hints
  if (lowerFilename.includes("steam")) {
    return parseGenericCSV(content); // Steam doesn't have native export, would be from third-party
  }
  if (lowerFilename.includes("backloggd")) {
    return parseBackloggdExport(content);
  }
  if (lowerFilename.includes("ggdeals") || lowerFilename.includes("gg.deals")) {
    return parseGGDealsExport(content);
  }
  if (lowerFilename.includes("hltb") || lowerFilename.includes("howlongtobeat")) {
    return parseHLTBExport(content);
  }
  if (lowerFilename.includes("grouvee")) {
    return parseGrouveeExport(content);
  }
  if (lowerFilename.includes("exophase")) {
    return parseExophaseExport(content);
  }
  if (lowerFilename.includes("rawg")) {
    return parseRAWGExport(content);
  }
  if (lowerFilename.includes("psn") || lowerFilename.includes("playstation")) {
    return parsePSNProfilesExport(content);
  }
  if (lowerFilename.includes("xbox") || lowerFilename.includes("trueachievements")) {
    return parseTrueAchievementsExport(content);
  }
  if (
    lowerFilename.includes("deku") ||
    lowerFilename.includes("nintendo") ||
    lowerFilename.includes("switch")
  ) {
    return parseDekuDealsExport(content);
  }

  // Check content structure
  if (content.trim().startsWith("{") || content.trim().startsWith("[")) {
    // JSON format
    try {
      const json = JSON.parse(content);

      // RAWG format detection
      if (json.results || (Array.isArray(json) && json[0]?.platforms)) {
        return parseRAWGExport(content);
      }

      // HLTB format detection
      if (
        json.games ||
        json.gamesList ||
        (Array.isArray(json) && json[0]?.comp_main !== undefined)
      ) {
        return parseHLTBExport(content);
      }

      // Generic JSON - try to extract as array
      return parseHLTBExport(content);
    } catch {
      return {
        source: "csv",
        total: 0,
        matched: 0,
        unmatched: 0,
        matches: [],
        errors: ["Invalid JSON format"],
      };
    }
  }

  // CSV format - detect by content
  if (lowerContent.includes("gamerscore") || lowerContent.includes("trueachievement")) {
    return parseTrueAchievementsExport(content);
  }
  if (lowerContent.includes("trophy") || lowerContent.includes("psn")) {
    return parsePSNProfilesExport(content);
  }
  if (lowerContent.includes("shelf") && lowerContent.includes("grouvee")) {
    return parseGrouveeExport(content);
  }

  // Default to generic CSV
  return parseGenericCSV(content);
}

// === Export Types for UI ===

export const IMPORT_SOURCES: {
  id: ImportSource;
  name: string;
  description: string;
  exportUrl?: string;
}[] = [
  {
    id: "steam",
    name: "Steam",
    description: "Import your Steam library using your Steam ID",
    exportUrl: undefined, // Direct API
  },
  {
    id: "backloggd",
    name: "Backloggd",
    description: "Import from Backloggd CSV export",
    exportUrl: "https://www.backloggd.com/settings/",
  },
  {
    id: "ggdeals",
    name: "GG.deals",
    description: "Import from GG.deals collection export",
    exportUrl: "https://gg.deals/collection/",
  },
  {
    id: "howlongtobeat",
    name: "HowLongToBeat",
    description: "Import from HLTB export (JSON)",
    exportUrl: "https://howlongtobeat.com/user?n=YOUR_USERNAME",
  },
  {
    id: "grouvee",
    name: "Grouvee",
    description: "Import from Grouvee CSV export",
    exportUrl: "https://www.grouvee.com/user/YOUR_USERNAME/export/",
  },
  {
    id: "exophase",
    name: "ExoPhase",
    description: "Import achievements from ExoPhase",
    exportUrl: "https://www.exophase.com/",
  },
  {
    id: "rawg",
    name: "RAWG.io",
    description: "Import from RAWG collection export",
    exportUrl: "https://rawg.io/",
  },
  {
    id: "playstation",
    name: "PlayStation (PSNProfiles)",
    description: "Import from PSNProfiles CSV export",
    exportUrl: "https://psnprofiles.com/",
  },
  {
    id: "xbox",
    name: "Xbox (TrueAchievements)",
    description: "Import from TrueAchievements CSV export",
    exportUrl: "https://www.trueachievements.com/",
  },
  {
    id: "nintendo",
    name: "Nintendo (Deku Deals)",
    description: "Import from Deku Deals collection",
    exportUrl: "https://www.dekudeals.com/collection",
  },
  {
    id: "csv",
    name: "Generic CSV",
    description: "Import any CSV with 'name' column",
    exportUrl: undefined,
  },
];
