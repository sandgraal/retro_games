/**
 * IGDB (Internet Game Database) API Adapter
 * Fetches game data from IGDB via Twitch API authentication
 *
 * Rate limits: 4 requests/second (free tier)
 * Documentation: https://api-docs.igdb.com/
 *
 * IGDB uses Apicalypse query language for requests.
 * Requires Twitch Developer credentials (Client ID + Secret).
 */

import { delay } from "./shared.js";

/**
 * Map IGDB platform IDs to standard platform names
 * Reference: https://api-docs.igdb.com/#platform
 */
const PLATFORM_MAP = {
  // PlayStation
  7: "PlayStation",
  8: "PlayStation 2",
  9: "PlayStation 3",
  48: "PlayStation 4",
  167: "PlayStation 5",
  38: "PSP",
  46: "PS Vita",
  // Nintendo
  4: "Nintendo 64",
  130: "Nintendo Switch",
  37: "Nintendo 3DS",
  20: "Nintendo DS",
  41: "Wii U",
  5: "Wii",
  24: "Game Boy Advance",
  22: "Game Boy Color",
  33: "Game Boy",
  19: "SNES",
  18: "NES",
  21: "GameCube",
  // Sega
  29: "Genesis",
  23: "Dreamcast",
  32: "Saturn",
  35: "Game Gear",
  64: "Master System",
  // Microsoft
  6: "PC",
  49: "Xbox One",
  169: "Xbox Series X",
  12: "Xbox 360",
  11: "Xbox",
  // Atari
  59: "Atari 2600",
  60: "Atari 7800",
  66: "Atari Jaguar",
  67: "Atari Lynx",
  // Other
  86: "TurboGrafx-16",
  79: "Neo Geo MVS",
  80: "Neo Geo AES",
  // Modern/Digital
  34: "Android",
  39: "iOS",
  163: "Steam VR",
  165: "PlayStation VR",
  390: "PlayStation VR2",
  386: "Meta Quest 2",
  471: "Meta Quest 3",
};

/**
 * IGDB fields to request for game records
 */
const GAME_FIELDS = [
  "id",
  "name",
  "slug",
  "summary",
  "storyline",
  "first_release_date",
  "rating",
  "aggregated_rating",
  "total_rating",
  "genres.name",
  "platforms.id",
  "platforms.name",
  "platforms.abbreviation",
  "cover.url",
  "cover.image_id",
  "screenshots.url",
  "screenshots.image_id",
  "age_ratings.category",
  "age_ratings.rating",
  "involved_companies.company.name",
  "involved_companies.developer",
  "involved_companies.publisher",
  "game_modes.name",
  "player_perspectives.name",
  "themes.name",
  "franchises.name",
  "collection.name",
  "external_games.category",
  "external_games.uid",
].join(",");

/**
 * Token cache for OAuth authentication
 */
let tokenCache = {
  accessToken: null,
  expiresAt: 0,
};

/**
 * Authenticate with Twitch to get IGDB access token
 * @param {string} clientId - Twitch Client ID
 * @param {string} clientSecret - Twitch Client Secret
 * @returns {Promise<string>} Access token
 */
async function getAccessToken(clientId, clientSecret) {
  // Return cached token if still valid (with 5 minute buffer)
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt - 300000) {
    return tokenCache.accessToken;
  }

  const response = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  );

  if (!response.ok) {
    throw new Error(`Twitch OAuth failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  console.log("[igdb] Obtained new access token");
  return tokenCache.accessToken;
}

/**
 * Make a request to IGDB API using Apicalypse query syntax
 * @param {string} endpoint - API endpoint (e.g., "games", "platforms")
 * @param {string} query - Apicalypse query body
 * @param {string} clientId - Twitch Client ID
 * @param {string} accessToken - OAuth access token
 * @returns {Promise<object[]>} Response data
 */
async function igdbRequest(endpoint, query, clientId, accessToken) {
  const response = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "text/plain",
    },
    body: query,
  });

  if (response.status === 429) {
    // Rate limited
    const retryAfter = response.headers.get("Retry-After") || 1;
    throw { status: 429, retryAfter: parseInt(retryAfter, 10) };
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `IGDB API error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  return response.json();
}

/**
 * Convert IGDB cover URL to high-resolution version
 * @param {string} url - Original cover URL
 * @param {string} size - Size identifier (cover_big, 720p, 1080p)
 * @returns {string} Transformed URL
 */
function transformCoverUrl(url, size = "cover_big") {
  if (!url) return null;
  // IGDB returns URLs like //images.igdb.com/igdb/image/upload/t_thumb/xxx.jpg
  // We need to change the size parameter
  return url
    .replace("//", "https://")
    .replace("t_thumb", `t_${size}`)
    .replace("t_cover_small", `t_${size}`);
}

/**
 * Get ESRB rating string from IGDB age rating
 * @param {object[]} ageRatings - IGDB age ratings array
 * @returns {string|null} ESRB rating string or null
 */
function getEsrbRating(ageRatings) {
  if (!ageRatings) return null;

  // IGDB age_rating.category: 1 = ESRB, 2 = PEGI
  const esrb = ageRatings.find((r) => r.category === 1);
  if (!esrb) return null;

  // IGDB ESRB rating values
  const esrbMap = {
    6: "RP", // Rating Pending
    7: "EC", // Early Childhood
    8: "E", // Everyone
    9: "E10+", // Everyone 10+
    10: "T", // Teen
    11: "M", // Mature 17+
    12: "AO", // Adults Only 18+
  };

  return esrbMap[esrb.rating] || null;
}

/**
 * Extract developers and publishers from involved companies
 * @param {object[]} companies - IGDB involved_companies array
 * @returns {{ developers: string[], publishers: string[] }}
 */
function extractCompanies(companies) {
  if (!companies) return { developers: [], publishers: [] };

  const developers = companies
    .filter((c) => c.developer && c.company?.name)
    .map((c) => c.company.name);

  const publishers = companies
    .filter((c) => c.publisher && c.company?.name)
    .map((c) => c.company.name);

  return { developers, publishers };
}

/**
 * Normalize an IGDB game record to our internal format
 * @param {object} game - Raw game object from IGDB API
 * @param {string} platformName - Platform name for this record
 * @param {number} platformId - IGDB platform ID
 * @returns {object} Normalized game record
 */
function normalizeIgdbGame(game, platformName, platformId) {
  const { developers, publishers } = extractCompanies(game.involved_companies);

  const releaseDate = game.first_release_date
    ? new Date(game.first_release_date * 1000).toISOString().split("T")[0]
    : null;

  const releaseYear = releaseDate ? new Date(releaseDate).getFullYear() : null;

  return {
    title: game.name,
    game_name: game.name,
    platform: platformName,
    platform_slug: game.slug,
    release_date: releaseDate,
    release_year: releaseYear,
    genres: game.genres?.map((g) => g.name) || [],
    esrb: getEsrbRating(game.age_ratings),
    cover_url: transformCoverUrl(game.cover?.url, "cover_big"),
    rating: game.total_rating ? Math.round(game.total_rating) / 10 : null,
    metacritic: game.aggregated_rating ? Math.round(game.aggregated_rating) : null,
    summary: game.summary || null,
    storyline: game.storyline || null,
    developers,
    publishers,
    game_modes: game.game_modes?.map((m) => m.name) || [],
    themes: game.themes?.map((t) => t.name) || [],
    franchise: game.franchises?.[0]?.name || game.collection?.name || null,
    assets: {
      cover: transformCoverUrl(game.cover?.url, "720p"),
      screenshots:
        game.screenshots?.map((s) => transformCoverUrl(s.url, "screenshot_big")) || [],
    },
    external_ids: {
      igdb: game.id,
      igdb_slug: game.slug,
    },
  };
}

/**
 * Fetch games from IGDB for a specific platform
 * @param {object} source - Source configuration
 * @param {object} platform - Platform config { id, name }
 * @param {string} accessToken - OAuth access token
 * @param {function} onProgress - Progress callback
 * @returns {AsyncGenerator<object>} Yields normalized game records
 */
async function* fetchIgdbPlatform(source, platform, accessToken, onProgress) {
  const clientId = source.clientId || process.env.IGDB_CLIENT_ID;
  const pageSize = source.pageSize || 500; // IGDB allows up to 500 per request
  const maxRecords = source.maxRecords || 50000;
  const rateLimitMs = source.rateLimit?.retryAfterMs || 250; // 4 req/sec

  let offset = 0;
  let totalFetched = 0;

  while (totalFetched < maxRecords) {
    // category 0 = main game, also include null category (many games don't have it set)
    const query = `
      fields ${GAME_FIELDS};
      where platforms = (${platform.id}) & (category = 0 | category = null);
      sort total_rating desc;
      limit ${pageSize};
      offset ${offset};
    `;

    try {
      const games = await igdbRequest("games", query, clientId, accessToken);

      if (!games || games.length === 0) {
        break; // No more results
      }

      for (const game of games) {
        yield normalizeIgdbGame(game, platform.name, platform.id);
        totalFetched++;
      }

      if (onProgress) {
        onProgress({
          platform: platform.name,
          offset,
          gamesInPage: games.length,
          totalFetched,
        });
      }

      if (games.length < pageSize) {
        break; // Last page
      }

      offset += pageSize;

      // Rate limiting
      await delay(rateLimitMs);
    } catch (error) {
      if (error.status === 429) {
        console.log(`[igdb] Rate limited, waiting ${error.retryAfter}s...`);
        await delay(error.retryAfter * 1000);
        continue; // Retry same request
      }
      console.error(
        `[igdb] Error fetching ${platform.name} at offset ${offset}:`,
        error.message
      );
      break; // Continue to next platform
    }
  }
}

/**
 * Fetch all games from IGDB based on source configuration
 * @param {object} source - Source configuration
 * @returns {Promise<object[]>} Array of normalized game records
 */
export async function fetchIgdbSource(source) {
  const clientId = source.clientId || process.env.IGDB_CLIENT_ID;
  const clientSecret = source.clientSecret || process.env.IGDB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn("[igdb] Missing credentials - skipping");
    return [];
  }

  // Get platforms from config or use defaults
  const platforms = source.platforms || getDefaultPlatforms();
  const records = [];

  console.log(`[igdb] Starting ingestion for ${platforms.length} platforms`);

  try {
    const accessToken = await getAccessToken(clientId, clientSecret);

    for (const platform of platforms) {
      console.log(`[igdb] Fetching platform: ${platform.name}`);

      for await (const game of fetchIgdbPlatform(
        source,
        platform,
        accessToken,
        (progress) => {
          if (progress.offset % 2500 === 0 && progress.offset > 0) {
            console.log(
              `[igdb] ${platform.name}: ${progress.totalFetched} games collected`
            );
          }
        }
      )) {
        records.push(game);
      }

      console.log(`[igdb] Completed ${platform.name}: ${records.length} total games`);
    }
  } catch (error) {
    console.error("[igdb] Ingestion failed:", error.message);
    throw error;
  }

  console.log(
    `[igdb] Ingestion complete: ${records.length} games from ${platforms.length} platforms`
  );
  return records;
}

/**
 * Fetch a single game's detailed information from IGDB
 * @param {string|number} gameId - IGDB game ID
 * @param {object} credentials - { clientId, clientSecret }
 * @returns {Promise<object|null>} Detailed game info or null if not found
 */
export async function fetchIgdbGameDetails(gameId, credentials = {}) {
  const clientId = credentials.clientId || process.env.IGDB_CLIENT_ID;
  const clientSecret = credentials.clientSecret || process.env.IGDB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn("[igdb] Missing credentials");
    return null;
  }

  try {
    const accessToken = await getAccessToken(clientId, clientSecret);

    const query = `
      fields ${GAME_FIELDS};
      where id = ${gameId};
    `;

    const games = await igdbRequest("games", query, clientId, accessToken);
    if (!games || games.length === 0) return null;

    const game = games[0];
    const platformName = game.platforms?.[0]
      ? PLATFORM_MAP[game.platforms[0].id] || game.platforms[0].name
      : "Unknown";

    return normalizeIgdbGame(game, platformName, game.platforms?.[0]?.id);
  } catch (error) {
    console.error(`[igdb] Error fetching game ${gameId}:`, error.message);
    return null;
  }
}

/**
 * Search for games by name
 * @param {string} query - Search query
 * @param {object} options - { limit, credentials }
 * @returns {Promise<object[]>} Array of matching games
 */
export async function searchIgdbGames(query, options = {}) {
  const clientId = options.credentials?.clientId || process.env.IGDB_CLIENT_ID;
  const clientSecret =
    options.credentials?.clientSecret || process.env.IGDB_CLIENT_SECRET;
  const limit = options.limit || 20;

  if (!clientId || !clientSecret) {
    console.warn("[igdb] Missing credentials");
    return [];
  }

  try {
    const accessToken = await getAccessToken(clientId, clientSecret);

    const apicalypse = `
      search "${query.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}";
      fields ${GAME_FIELDS};
      where category = 0;
      limit ${limit};
    `;

    const games = await igdbRequest("games", apicalypse, clientId, accessToken);

    return games.map((game) => {
      const platformName = game.platforms?.[0]
        ? PLATFORM_MAP[game.platforms[0].id] || game.platforms[0].name
        : "Unknown";
      return normalizeIgdbGame(game, platformName, game.platforms?.[0]?.id);
    });
  } catch (error) {
    console.error(`[igdb] Search error:`, error.message);
    return [];
  }
}

/**
 * Get default platform configuration for IGDB ingestion
 * Prioritized by the Universal Expansion roadmap
 * @returns {object[]} Array of platform configs { id, name }
 */
export function getDefaultPlatforms() {
  return [
    // High Priority - Current Gen
    { id: 167, name: "PlayStation 5" },
    { id: 169, name: "Xbox Series X" },
    { id: 130, name: "Nintendo Switch" },
    { id: 6, name: "PC" },
    // High Priority - Last Gen
    { id: 48, name: "PlayStation 4" },
    { id: 49, name: "Xbox One" },
    { id: 41, name: "Wii U" },
    { id: 37, name: "Nintendo 3DS" },
    { id: 46, name: "PS Vita" },
    // Retro - Nintendo
    { id: 19, name: "SNES" },
    { id: 18, name: "NES" },
    { id: 4, name: "Nintendo 64" },
    { id: 21, name: "GameCube" },
    { id: 5, name: "Wii" },
    { id: 24, name: "Game Boy Advance" },
    { id: 22, name: "Game Boy Color" },
    { id: 33, name: "Game Boy" },
    { id: 20, name: "Nintendo DS" },
    // Retro - PlayStation
    { id: 7, name: "PlayStation" },
    { id: 8, name: "PlayStation 2" },
    { id: 9, name: "PlayStation 3" },
    { id: 38, name: "PSP" },
    // Retro - Sega
    { id: 29, name: "Genesis" },
    { id: 23, name: "Dreamcast" },
    { id: 32, name: "Saturn" },
    { id: 64, name: "Master System" },
    { id: 35, name: "Game Gear" },
    // Retro - Microsoft
    { id: 11, name: "Xbox" },
    { id: 12, name: "Xbox 360" },
    // Other Classic
    { id: 86, name: "TurboGrafx-16" },
    { id: 59, name: "Atari 2600" },
    // VR (Medium Priority)
    { id: 165, name: "PlayStation VR" },
    { id: 390, name: "PlayStation VR2" },
    { id: 386, name: "Meta Quest 2" },
  ];
}

/**
 * Get the IGDB platform map for reference
 * @returns {object} Platform ID to name mapping
 */
export function getPlatformMap() {
  return { ...PLATFORM_MAP };
}

export default {
  fetchIgdbSource,
  fetchIgdbGameDetails,
  searchIgdbGames,
  getDefaultPlatforms,
  getPlatformMap,
};
