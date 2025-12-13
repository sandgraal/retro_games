/**
 * RAWG.io API Adapter
 * Fetches game data from RAWG.io's free API
 *
 * Rate limits: 20,000 requests/month on free tier
 * Documentation: https://rawg.io/apidocs
 */

import { delay } from "./shared.js";

/**
 * Map RAWG platform IDs to standard platform names
 */
const PLATFORM_MAP = {
  // PlayStation
  27: "PlayStation",
  15: "PlayStation 2",
  105: "PlayStation 3",
  18: "PlayStation 4",
  187: "PlayStation 5",
  17: "PSP",
  19: "PS Vita",
  // Nintendo
  83: "Nintendo 64",
  7: "Nintendo Switch",
  8: "Nintendo 3DS",
  9: "Nintendo DS",
  10: "Wii U",
  11: "Wii",
  24: "Game Boy Advance",
  43: "Game Boy Color",
  26: "Game Boy",
  79: "SNES",
  49: "NES",
  // Note: GameCube ID varies; use config.platforms to pass correct name
  // Sega
  167: "Genesis",
  107: "Dreamcast",
  119: "Saturn",
  // Microsoft
  4: "PC",
  1: "Xbox One",
  186: "Xbox Series X",
  14: "Xbox 360",
  80: "Xbox",
  // Atari
  28: "Atari 2600",
  31: "Atari 7800",
  // Other
  117: "TurboGrafx-16",
  12: "Neo Geo",
};

/**
 * Normalize a RAWG game record to our internal format
 * @param {object} game - Raw game object from RAWG API
 * @param {string} platformName - Platform name for this record
 * @returns {object} Normalized game record
 */
function normalizeRawgGame(game, platformName) {
  return {
    title: game.name,
    game_name: game.name,
    platform: platformName,
    platform_slug: game.slug,
    release_date: game.released,
    release_year: game.released ? new Date(game.released).getFullYear() : null,
    genres: game.genres?.map((g) => g.name) || [],
    esrb: game.esrb_rating?.name || null,
    cover_url: game.background_image,
    rating: game.rating,
    metacritic: game.metacritic,
    assets: {
      cover: game.background_image,
      screenshots: [],
    },
    external_ids: {
      rawg: game.id,
      rawg_slug: game.slug,
    },
  };
}

/**
 * Fetch games from RAWG.io for a specific platform
 * @param {object} source - Source configuration
 * @param {object} platform - Platform config { id, name, slug }
 * @param {function} onProgress - Progress callback
 * @returns {AsyncGenerator<object>} Yields normalized game records
 */
async function* fetchRawgPlatform(source, platform, onProgress) {
  const apiKey = source.apiKey || process.env.RAWG_API_KEY;
  if (!apiKey) {
    console.warn("[rawg] No API key configured - skipping");
    return;
  }

  const baseUrl = source.baseUrl || "https://api.rawg.io/api";
  const pageSize = source.pageSize || 40;
  const maxPages = source.maxPages || 250;
  const rateLimitMs = source.rateLimit?.retryAfterMs || 200;

  let page = 1;
  let hasMore = true;

  while (hasMore && page <= maxPages) {
    const url = `${baseUrl}/games?key=${apiKey}&platforms=${platform.id}&page=${page}&page_size=${pageSize}&ordering=-rating`;

    try {
      const response = await fetch(url);

      if (response.status === 429) {
        // Rate limited - wait and retry
        console.log(`[rawg] Rate limited, waiting ${rateLimitMs * 2}ms...`);
        await delay(rateLimitMs * 2);
        continue;
      }

      if (!response.ok) {
        throw new Error(`RAWG API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const games = data.results || [];

      for (const game of games) {
        yield normalizeRawgGame(game, platform.name);
      }

      if (onProgress) {
        onProgress({
          platform: platform.name,
          page,
          totalPages: Math.ceil((data.count || 0) / pageSize),
          gamesInPage: games.length,
          totalGames: data.count || 0,
        });
      }

      hasMore = !!data.next;
      page++;

      // Rate limiting
      await delay(rateLimitMs);
    } catch (error) {
      console.error(
        `[rawg] Error fetching ${platform.name} page ${page}:`,
        error.message
      );
      // Continue to next platform rather than failing entirely
      break;
    }
  }
}

/**
 * Fetch all games from RAWG.io based on source configuration
 * @param {object} source - Source configuration
 * @returns {Promise<object[]>} Array of normalized game records
 */
export async function fetchRawgSource(source) {
  const platforms = source.platforms || [];
  const records = [];

  console.log(`[rawg] Starting ingestion for ${platforms.length} platforms`);

  for (const platform of platforms) {
    console.log(`[rawg] Fetching platform: ${platform.name}`);

    for await (const game of fetchRawgPlatform(source, platform, (progress) => {
      if (progress.page % 10 === 0) {
        console.log(
          `[rawg] ${platform.name}: page ${progress.page}/${progress.totalPages}, ${records.length} games collected`
        );
      }
    })) {
      records.push(game);
    }

    console.log(`[rawg] Completed ${platform.name}: ${records.length} total games`);
  }

  console.log(
    `[rawg] Ingestion complete: ${records.length} games from ${platforms.length} platforms`
  );
  return records;
}

/**
 * Fetch a single game's detailed information from RAWG
 * @param {string|number} gameId - RAWG game ID or slug
 * @returns {Promise<object|null>} Detailed game info or null if not found
 */
export async function fetchRawgGameDetails(gameId) {
  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) return null;

  const url = `https://api.rawg.io/api/games/${gameId}?key=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const game = await response.json();

    return {
      id: game.id,
      name: game.name,
      slug: game.slug,
      description: game.description_raw,
      released: game.released,
      rating: game.rating,
      metacritic: game.metacritic,
      playtime: game.playtime,
      background_image: game.background_image,
      developers: game.developers?.map((d) => d.name) || [],
      publishers: game.publishers?.map((p) => p.name) || [],
      genres: game.genres?.map((g) => g.name) || [],
      tags: game.tags?.map((t) => t.name) || [],
      esrb_rating: game.esrb_rating?.name,
      platforms:
        game.platforms?.map((p) => ({
          id: p.platform.id,
          name: p.platform.name,
          slug: p.platform.slug,
        })) || [],
      screenshots: game.screenshots?.map((s) => s.image) || [],
      website: game.website,
      reddit_url: game.reddit_url,
    };
  } catch (error) {
    console.error(`[rawg] Error fetching game details for ${gameId}:`, error.message);
    return null;
  }
}

/**
 * Search RAWG.io for games matching a query
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @returns {Promise<object[]>} Array of matching games
 */
export async function searchRawg(query, options = {}) {
  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) return [];

  const { pageSize = 20, page = 1, platforms } = options;
  let url = `https://api.rawg.io/api/games?key=${apiKey}&search=${encodeURIComponent(query)}&page=${page}&page_size=${pageSize}`;

  if (platforms) {
    url += `&platforms=${platforms.join(",")}`;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    return (data.results || []).map((game) => ({
      id: game.id,
      name: game.name,
      slug: game.slug,
      released: game.released,
      rating: game.rating,
      background_image: game.background_image,
      platforms: game.platforms?.map((p) => p.platform.name) || [],
    }));
  } catch (error) {
    console.error(`[rawg] Search error:`, error.message);
    return [];
  }
}

export default {
  fetchRawgSource,
  fetchRawgGameDetails,
  searchRawg,
  PLATFORM_MAP,
};
