/**
 * Steam Web API Adapter
 * Fetches game data from Steam's public APIs
 *
 * APIs Used:
 * - Steam Storefront API (no key required)
 * - Steam Web API (key required for some endpoints)
 * - SteamSpy API (third-party, no key required)
 *
 * Rate limits: ~200 requests/5 minutes for Store API
 * Documentation: https://partner.steamgames.com/doc/webapi
 */

import { delay, createRateLimiter } from "./shared.js";

/**
 * Genre mapping from Steam to standardized names
 */
const GENRE_MAP = {
  Action: "Action",
  Adventure: "Adventure",
  Casual: "Casual",
  Indie: "Indie",
  "Massively Multiplayer": "MMO",
  Racing: "Racing",
  RPG: "RPG",
  Simulation: "Simulation",
  Sports: "Sports",
  Strategy: "Strategy",
  "Early Access": "Early Access",
  "Free to Play": "Free to Play",
  Violent: "Action",
  Gore: "Action",
  "Sexual Content": "Mature",
};

// Rate limiter: 180 requests per 5 minutes (conservative)
const rateLimiter = createRateLimiter(180, 5 * 60 * 1000);

/**
 * Check and enforce rate limiting
 */
async function checkRateLimit() {
  await rateLimiter.check();
}

/**
 * Fetch the complete list of Steam apps
 * @returns {Promise<object[]>} Array of { appid, name }
 */
async function fetchAppList() {
  await checkRateLimit();

  const response = await fetch("https://api.steampowered.com/ISteamApps/GetAppList/v2/");

  if (!response.ok) {
    throw new Error(`Steam API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.applist?.apps || [];
}

/**
 * Fetch detailed app information from Steam Store API
 * @param {number} appId - Steam App ID
 * @param {string} region - Store region (e.g., 'us', 'uk')
 * @returns {Promise<object|null>} App details or null if not found/not a game
 */
async function fetchAppDetails(appId, region = "us") {
  await checkRateLimit();

  const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=${region}&l=en`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Dragons-Hoard-Atlas/2.1.0",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw { status: 429, retryAfter: 60 };
      }
      return null;
    }

    const data = await response.json();
    const appData = data[appId];

    if (!appData?.success || !appData.data) {
      return null;
    }

    const game = appData.data;

    // Only process games (not DLC, demos, etc.)
    if (game.type !== "game") {
      return null;
    }

    return game;
  } catch (error) {
    if (error.status === 429) {
      throw error;
    }
    console.error(`[steam] Error fetching app ${appId}:`, error.message);
    return null;
  }
}

/**
 * Fetch pricing information for an app
 * @param {number} appId - Steam App ID
 * @param {string} region - Store region
 * @returns {Promise<object|null>} Pricing info
 */
async function fetchAppPricing(appId, region = "us") {
  const details = await fetchAppDetails(appId, region);
  if (!details) return null;

  const priceInfo = details.price_overview;
  if (!priceInfo) {
    return {
      appId,
      isFree: details.is_free,
      priceCents: 0,
      currency: "USD",
      discountPercent: 0,
    };
  }

  return {
    appId,
    isFree: details.is_free || false,
    priceCents: priceInfo.final || 0,
    originalPriceCents: priceInfo.initial || priceInfo.final,
    currency: priceInfo.currency || "USD",
    discountPercent: priceInfo.discount_percent || 0,
    formattedPrice: priceInfo.final_formatted,
  };
}

/**
 * Normalize a Steam game record to our internal format
 * @param {object} game - Raw game object from Steam Store API
 * @returns {object} Normalized game record
 */
function normalizeSteamGame(game) {
  // Extract release year
  let releaseYear = null;
  if (game.release_date?.date) {
    const match = game.release_date.date.match(/\d{4}/);
    if (match) {
      releaseYear = parseInt(match[0], 10);
    }
  }

  // Normalize genres
  const genres = (game.genres || [])
    .map((g) => GENRE_MAP[g.description] || g.description)
    .filter(Boolean);

  // Extract developer/publisher
  const developers = game.developers || [];
  const publishers = game.publishers || [];

  // Get price info
  const priceInfo = game.price_overview || {};
  const isFree = game.is_free || false;

  // Get metacritic score
  const metacritic = game.metacritic?.score || null;

  return {
    title: game.name,
    game_name: game.name,
    platform: "PC",
    platform_slug: "steam",
    release_date: game.release_date?.date || null,
    release_year: releaseYear,
    genres,
    esrb: game.required_age > 0 ? `${game.required_age}+` : null,
    cover_url: game.header_image,
    rating: metacritic ? metacritic / 10 : null, // Normalize to 0-10 scale
    metacritic,
    description: game.short_description || game.detailed_description,
    developers,
    publishers,
    tags: game.categories?.map((c) => c.description) || [],
    assets: {
      cover: game.header_image,
      capsule: game.capsule_image,
      screenshots: game.screenshots?.map((s) => s.path_full) || [],
      movies:
        game.movies?.map((m) => ({
          id: m.id,
          name: m.name,
          thumbnail: m.thumbnail,
          webm: m.webm?.max,
          mp4: m.mp4?.max,
        })) || [],
    },
    pricing: {
      isFree,
      priceCents: priceInfo.final || 0,
      originalPriceCents: priceInfo.initial || priceInfo.final || 0,
      currency: priceInfo.currency || "USD",
      discountPercent: priceInfo.discount_percent || 0,
    },
    external_ids: {
      steam: game.steam_appid,
    },
    steam_data: {
      appId: game.steam_appid,
      type: game.type,
      isFree,
      supportedLanguages: game.supported_languages,
      website: game.website,
      pcRequirements: game.pc_requirements,
      linuxSupport: !!game.linux_requirements?.minimum,
      macSupport: !!game.mac_requirements?.minimum,
      achievements: game.achievements?.total || 0,
      recommendations: game.recommendations?.total || 0,
      comingSoon: game.release_date?.coming_soon || false,
    },
  };
}

/**
 * Fetch top games from SteamSpy (third-party API)
 * @param {string} request - Request type (all, top100in2weeks, top100forever, etc.)
 * @param {number} page - Page number for 'all' request
 * @returns {Promise<object[]>} Array of game summaries
 */
async function fetchSteamSpyList(request = "top100in2weeks", page = 0) {
  await checkRateLimit();

  let url = `https://steamspy.com/api.php?request=${request}`;
  if (request === "all" && page > 0) {
    url += `&page=${page}`;
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Dragons-Hoard-Atlas/2.1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`SteamSpy API error: ${response.status}`);
    }

    const data = await response.json();

    // SteamSpy returns object keyed by appid
    return Object.entries(data).map(([appid, game]) => ({
      appId: parseInt(appid, 10),
      name: game.name,
      developer: game.developer,
      publisher: game.publisher,
      owners: game.owners,
      averagePlaytime: game.average_forever,
      medianPlaytime: game.median_forever,
      ccu: game.ccu, // Concurrent users
      price: game.price ? game.price / 100 : 0, // Convert cents to dollars
      score: game.score_rank,
    }));
  } catch (error) {
    console.error(`[steam] SteamSpy error:`, error.message);
    return [];
  }
}

/**
 * Fetch games from Steam based on source configuration
 * Uses a combination of SteamSpy for discovery and Store API for details
 *
 * @param {object} source - Source configuration
 * @returns {Promise<object[]>} Array of normalized game records
 */
export async function fetchSteamSource(source) {
  const records = [];
  const maxGames = source.limit || 1000;
  const delayMs = source.rateLimit?.retryAfterMs || 1500;

  console.log(`[steam] Starting ingestion (limit: ${maxGames} games)`);

  // Strategy: Use SteamSpy to get popular games, then fetch details from Store API
  // This is more efficient than iterating through all 100k+ apps

  // Get top games from multiple lists
  const sources = [
    { request: "top100in2weeks", label: "trending" },
    { request: "top100forever", label: "all-time" },
  ];

  // If we want more games, paginate through SteamSpy's 'all' endpoint
  if (maxGames > 200) {
    const pages = Math.ceil((maxGames - 200) / 1000);
    for (let i = 0; i < pages; i++) {
      sources.push({ request: "all", page: i, label: `page-${i}` });
    }
  }

  const seenAppIds = new Set();

  for (const src of sources) {
    if (records.length >= maxGames) break;

    console.log(`[steam] Fetching ${src.label} list...`);

    const games = await fetchSteamSpyList(src.request, src.page || 0);
    console.log(`[steam] Found ${games.length} games in ${src.label}`);

    for (const game of games) {
      if (records.length >= maxGames) break;
      if (seenAppIds.has(game.appId)) continue;

      seenAppIds.add(game.appId);

      try {
        // Fetch full details from Store API
        const details = await fetchAppDetails(game.appId);

        if (details) {
          const normalized = normalizeSteamGame(details);
          records.push(normalized);

          if (records.length % 50 === 0) {
            console.log(`[steam] Progress: ${records.length}/${maxGames} games`);
          }
        }

        // Rate limiting delay
        await delay(delayMs);
      } catch (error) {
        if (error.status === 429) {
          console.log(`[steam] Rate limited, waiting 60s...`);
          await delay(60000);
          // Retry this game
          seenAppIds.delete(game.appId);
        } else {
          console.error(`[steam] Error fetching ${game.name}:`, error.message);
        }
      }
    }
  }

  console.log(`[steam] Ingestion complete: ${records.length} games`);
  return records;
}

/**
 * Fetch a single game's detailed information from Steam
 * @param {number} appId - Steam App ID
 * @returns {Promise<object|null>} Normalized game info or null if not found
 */
export async function fetchSteamGameDetails(appId) {
  const details = await fetchAppDetails(appId);
  if (!details) return null;

  return normalizeSteamGame(details);
}

/**
 * Search Steam for games matching a query
 * Uses the Steam Store search endpoint
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @returns {Promise<object[]>} Array of matching games
 */
export async function searchSteam(query, options = {}) {
  await checkRateLimit();

  const { maxResults = 20 } = options;

  // Steam doesn't have a true search API, but we can use the store search
  // This returns HTML, so we'll use a workaround with the storefront API
  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=en&cc=us`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Dragons-Hoard-Atlas/2.1.0",
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    const items = (data.items || []).slice(0, maxResults);

    return items.map((item) => ({
      appId: item.id,
      name: item.name,
      type: item.type,
      price: item.price?.final,
      discountPercent: item.price?.discount_percent,
      logo: item.tiny_image,
      metascore: item.metascore,
      platforms: {
        windows: item.platforms?.windows,
        mac: item.platforms?.mac,
        linux: item.platforms?.linux,
      },
    }));
  } catch (error) {
    console.error(`[steam] Search error:`, error.message);
    return [];
  }
}

/**
 * Fetch pricing for multiple Steam games
 * @param {number[]} appIds - Array of Steam App IDs
 * @param {string} region - Store region
 * @returns {Promise<Map<number, object>>} Map of appId -> pricing info
 */
export async function fetchBulkPricing(appIds, region = "us") {
  const prices = new Map();

  // Steam only allows single-app requests for details
  // But we can batch up to 100 apps for a simpler price check
  for (const appId of appIds) {
    try {
      const pricing = await fetchAppPricing(appId, region);
      if (pricing) {
        prices.set(appId, pricing);
      }
      await delay(300); // Rate limit
    } catch (error) {
      console.error(`[steam] Error fetching price for ${appId}:`, error.message);
    }
  }

  return prices;
}

/**
 * Get currently featured/on-sale games
 * @returns {Promise<object[]>} Array of featured games
 */
export async function fetchFeaturedGames() {
  await checkRateLimit();

  const url = "https://store.steampowered.com/api/featured/";

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Dragons-Hoard-Atlas/2.1.0",
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    const featured = [
      ...(data.featured_win || []),
      ...(data.featured_mac || []),
      ...(data.featured_linux || []),
    ];

    // Deduplicate by appId
    const seen = new Set();
    return featured
      .filter((game) => {
        if (seen.has(game.id)) return false;
        seen.add(game.id);
        return true;
      })
      .map((game) => ({
        appId: game.id,
        name: game.name,
        type: game.type,
        discounted: game.discounted,
        discountPercent: game.discount_percent,
        originalPrice: game.original_price,
        finalPrice: game.final_price,
        currency: game.currency,
        headerImage: game.header_image,
        smallCapsuleImage: game.small_capsule_image,
        largeCapsuleImage: game.large_capsule_image,
      }));
  } catch (error) {
    console.error(`[steam] Error fetching featured games:`, error.message);
    return [];
  }
}

export default {
  fetchSteamSource,
  fetchSteamGameDetails,
  searchSteam,
  fetchAppDetails,
  fetchAppPricing,
  fetchBulkPricing,
  fetchFeaturedGames,
  fetchSteamSpyList,
  GENRE_MAP,
};
