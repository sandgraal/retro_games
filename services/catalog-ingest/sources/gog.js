/**
 * GOG.com API Adapter
 * Fetches game data from GOG.com's public APIs
 *
 * Note: GOG doesn't have an official public API, but provides some
 * endpoints that can be used for catalog data.
 *
 * Endpoints used:
 * - GOG Galaxy API (requires Galaxy client auth)
 * - Public store catalog endpoints
 * - GOG Database (gogdb.org) - third-party, comprehensive
 *
 * Rate limits: Be respectful, ~1 request/second recommended
 */

import { delay } from "./shared.js";

/**
 * Genre mapping from GOG to standardized names
 */
const GENRE_MAP = {
  action: "Action",
  adventure: "Adventure",
  rpg: "RPG",
  strategy: "Strategy",
  simulation: "Simulation",
  sports: "Sports",
  racing: "Racing",
  shooter: "Action",
  puzzle: "Puzzle",
  arcade: "Arcade",
  platformer: "Platformer",
  "point-and-click": "Adventure",
  "role-playing": "RPG",
  "real-time-strategy": "Strategy",
  "turn-based-strategy": "Strategy",
};

/**
 * Normalize a GOG game record to our internal format
 * @param {object} game - Raw game object from GOG API
 * @returns {object} Normalized game record
 */
function normalizeGogGame(game) {
  // Extract release year
  let releaseYear = null;
  if (game.releaseDate || game.release_date) {
    const date = new Date(game.releaseDate || game.release_date);
    if (!isNaN(date.getTime())) {
      releaseYear = date.getFullYear();
    }
  }

  // Normalize genres
  const genres = (game.genres || [])
    .map((g) => {
      const name = typeof g === "string" ? g : g.name || g.slug;
      return GENRE_MAP[name?.toLowerCase()] || name;
    })
    .filter(Boolean);

  // Get developer/publisher
  const developer = game.developer || game.developers?.[0]?.name || null;
  const publisher = game.publisher || game.publishers?.[0]?.name || null;

  return {
    title: game.title || game.name,
    game_name: game.title || game.name,
    platform: "PC",
    platform_slug: "gog",
    release_date: game.releaseDate || game.release_date || null,
    release_year: releaseYear,
    genres,
    esrb: null, // GOG doesn't provide ESRB ratings directly
    cover_url: game.image || game.images?.logo2x || game.boxArtImage,
    rating: game.rating ? parseFloat(game.rating) / 10 : null, // Normalize to 0-10
    description: game.description || null,
    developers: developer ? [developer] : [],
    publishers: publisher ? [publisher] : [],
    tags: game.tags?.map((t) => (typeof t === "string" ? t : t.name)) || [],
    assets: {
      cover: game.image || game.images?.logo2x,
      background: game.images?.background,
      screenshots: game.screenshots?.map((s) => s.image_url || s) || [],
    },
    pricing: {
      isFree: game.price?.isFree || game.price?.amount === "0.00",
      priceCents: game.price?.amount
        ? Math.round(parseFloat(game.price.amount) * 100)
        : 0,
      originalPriceCents: game.price?.baseAmount
        ? Math.round(parseFloat(game.price.baseAmount) * 100)
        : 0,
      currency: game.price?.currency || "USD",
      discountPercent: game.price?.discount || 0,
    },
    external_ids: {
      gog: game.id,
      gog_slug: game.slug,
    },
    gog_data: {
      id: game.id,
      slug: game.slug,
      url: game.url || `https://www.gog.com/game/${game.slug}`,
      isDlc: game.isDlc || game.is_dlc || false,
      isComingSoon: game.isComingSoon || game.coming_soon || false,
      isInDevelopment: game.isInDevelopment || game.in_development || false,
      drm: "DRM-Free", // GOG's main selling point
      features: game.features || [],
      operatingSystems: game.operatingSystems || game.os || [],
    },
  };
}

/**
 * Fetch games from GOG.com public catalog endpoint
 * Note: This uses the public storefront API which has limited data
 *
 * @param {object} source - Source configuration
 * @returns {Promise<object[]>} Array of normalized game records
 */
export async function fetchGogSource(source) {
  const records = [];
  const maxGames = source.limit || 500;
  const delayMs = source.rateLimit?.retryAfterMs || 1000;

  console.log(`[gog] Starting ingestion (limit: ${maxGames} games)`);

  // GOG's public API endpoint for catalog
  // This endpoint provides paginated game listings
  const baseUrl = "https://catalog.gog.com/v1/catalog";

  let page = 1;
  const pageSize = 48; // GOG's default page size

  while (records.length < maxGames) {
    try {
      const url = `${baseUrl}?limit=${pageSize}&page=${page}&order=desc:score&productType=in:game,pack`;

      const response = await fetch(url, {
        headers: {
          "User-Agent": "Dragons-Hoard-Atlas/2.1.0",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.log(`[gog] Rate limited, waiting 60s...`);
          await delay(60000);
          continue;
        }
        console.warn(`[gog] API error: ${response.status}`);
        break;
      }

      const data = await response.json();
      const products = data.products || [];

      if (products.length === 0) {
        console.log(`[gog] No more products found`);
        break;
      }

      for (const game of products) {
        if (records.length >= maxGames) break;

        // Skip DLC and non-games
        if (game.productType !== "game" && game.productType !== "pack") continue;

        const normalized = normalizeGogGame(game);
        records.push(normalized);
      }

      console.log(
        `[gog] Page ${page}: ${products.length} products, ${records.length} total`
      );

      // Check if there are more pages
      if (data.pages && page >= data.pages) {
        break;
      }

      page++;
      await delay(delayMs);
    } catch (error) {
      console.error(`[gog] Error fetching page ${page}:`, error.message);
      break;
    }
  }

  console.log(`[gog] Ingestion complete: ${records.length} games`);
  return records;
}

/**
 * Fetch a single game's detailed information from GOG
 * @param {string|number} gameIdOrSlug - GOG game ID or slug
 * @returns {Promise<object|null>} Normalized game info or null if not found
 */
export async function fetchGogGameDetails(gameIdOrSlug) {
  try {
    // Try the product endpoint
    const url = `https://api.gog.com/products/${gameIdOrSlug}?expand=description,screenshots,videos`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Dragons-Hoard-Atlas/2.1.0",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const game = await response.json();
    return normalizeGogGame(game);
  } catch (error) {
    console.error(`[gog] Error fetching game details:`, error.message);
    return null;
  }
}

/**
 * Search GOG.com for games matching a query
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @returns {Promise<object[]>} Array of matching games
 */
export async function searchGog(query, options = {}) {
  const { maxResults = 20 } = options;

  try {
    const url = `https://embed.gog.com/games/ajax/filtered?mediaType=game&search=${encodeURIComponent(query)}&limit=${maxResults}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Dragons-Hoard-Atlas/2.1.0",
        Accept: "application/json",
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return (data.products || []).map((game) => ({
      id: game.id,
      title: game.title,
      slug: game.slug,
      price: game.price?.amount,
      discountPercent: game.price?.discountPercentage,
      image: game.image,
      url: game.url,
      rating: game.rating,
      category: game.category,
    }));
  } catch (error) {
    console.error(`[gog] Search error:`, error.message);
    return [];
  }
}

/**
 * Fetch currently on-sale games from GOG
 * @returns {Promise<object[]>} Array of games on sale
 */
export async function fetchGogSales() {
  try {
    const url = `https://catalog.gog.com/v1/catalog?limit=48&discounted=eq:true&order=desc:discount`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Dragons-Hoard-Atlas/2.1.0",
        Accept: "application/json",
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return (data.products || []).map((game) => ({
      id: game.id,
      title: game.title,
      slug: game.slug,
      originalPrice: game.price?.base,
      salePrice: game.price?.final,
      discountPercent: game.price?.discount,
      coverUrl: game.coverHorizontal || game.coverVertical,
      url: `https://www.gog.com/game/${game.slug}`,
    }));
  } catch (error) {
    console.error(`[gog] Error fetching sales:`, error.message);
    return [];
  }
}

export default {
  fetchGogSource,
  fetchGogGameDetails,
  searchGog,
  fetchGogSales,
  GENRE_MAP,
};
