/**
 * SEO helpers for structured data and metadata.
 * Generates JSON-LD schema.org markup for VideoGame content.
 * @module features/seo
 */

// === Constants ===

/** Default limit for structured data candidates */
export const STRUCTURED_DATA_LIMIT = 6;

/** Structured data script element ID */
export const STRUCTURED_DATA_ID = "site-structured-data";

// === Slug Generation ===

/**
 * Generate a URL-friendly slug for structured data IDs.
 * @param {string} name - Game name
 * @param {string} platform - Platform name
 * @returns {string} URL-safe slug
 */
export function slugifyStructuredDataId(name, platform) {
  const combined = `${name || ""}-${platform || ""}`;
  return combined
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

// === Image URL Normalization ===

/**
 * Normalize a cover path into an absolute URL.
 * @param {string|undefined} value - Image path or URL
 * @param {string} origin - Site origin
 * @returns {string|undefined} Absolute URL or undefined
 */
export function normalizeImageUrlForSeo(value, origin) {
  if (!value) return undefined;
  const stringValue = value.toString();
  if (/^https?:\/\//i.test(stringValue)) return stringValue;
  if (stringValue.startsWith("//")) {
    const protocol =
      typeof window !== "undefined" && window.location
        ? window.location.protocol
        : "https:";
    return `${protocol}${stringValue}`;
  }
  if (!origin) return undefined;
  if (stringValue.startsWith("/")) return `${origin}${stringValue}`;
  return `${origin}/${stringValue}`;
}

// === Release Year Extraction ===

/**
 * Extract release year from a game row.
 * @param {Object} game - Game data object
 * @returns {number|null} Release year or null
 */
export function extractReleaseYear(game) {
  if (!game) return null;

  // Check common year fields
  const yearFields = [
    "release_year",
    "releaseYear",
    "year",
    "release_date",
    "releaseDate",
  ];

  for (const field of yearFields) {
    const value = game[field];
    if (value != null) {
      const parsed = parseInt(value, 10);
      if (!Number.isNaN(parsed) && parsed >= 1970 && parsed <= 2100) {
        return parsed;
      }
    }
  }

  return null;
}

// === Candidate Selection ===

/**
 * @typedef {Object} StructuredDataEntry
 * @property {Object} game - Original game object
 * @property {number|null} rating - Numeric rating
 * @property {number|null} year - Release year
 * @property {string} identifier - Unique identifier
 */

/**
 * Select top-rated unique games for structured data.
 * @param {Object[]} games - Array of game objects
 * @param {number} [limit=6] - Maximum candidates
 * @returns {StructuredDataEntry[]} Top candidates
 */
export function getStructuredDataCandidates(games, limit = STRUCTURED_DATA_LIMIT) {
  if (!Array.isArray(games) || !games.length) return [];

  const unique = [];
  const seen = new Set();

  const entries = games
    .map((game) => {
      const rating = parseFloat(game.rating);
      const normalizedRating = Number.isFinite(rating) ? rating : null;
      const year = extractReleaseYear(game);
      const name = (game.game_name || game.name || "").toString().trim().toLowerCase();
      const platform = (game.platform || "").toString().trim().toLowerCase();
      const identifier = `${name}|${platform}`;

      return {
        game,
        rating: normalizedRating,
        year: typeof year === "number" ? year : null,
        identifier,
      };
    })
    .filter((entry) => entry.rating !== null && entry.identifier.trim().length > 1);

  // Sort by rating (desc), year (desc), name (asc)
  entries.sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    if (a.year !== b.year) {
      const safeA = a.year === null ? -Infinity : a.year;
      const safeB = b.year === null ? -Infinity : b.year;
      return safeB - safeA;
    }
    const nameA = (a.game.game_name || a.game.name || "").toString().toLowerCase();
    const nameB = (b.game.game_name || b.game.name || "").toString().toLowerCase();
    return nameA.localeCompare(nameB);
  });

  for (const entry of entries) {
    if (!seen.has(entry.identifier) && unique.length < limit) {
      unique.push(entry);
      seen.add(entry.identifier);
    }
  }

  return unique;
}

// === Schema.org Mapping ===

/**
 * Convert a game entry into schema.org VideoGame representation.
 * @param {StructuredDataEntry} entry - Game entry
 * @param {string} origin - Site origin URL
 * @returns {Object} Schema.org VideoGame object
 */
export function mapGameToVideoGameSchema(entry, origin) {
  const { game, rating } = entry;
  const name = (game.game_name || game.name || "").toString();
  const platform = (game.platform || "").toString();
  const slug = slugifyStructuredDataId(name, platform);
  const url =
    origin && slug ? `${origin}/#game-${slug}` : slug ? `#game-${slug}` : origin || "";

  const genreValue = game.genre || "";
  const genreList = genreValue
    ? genreValue
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean)
    : undefined;

  const releaseYear = extractReleaseYear(game);
  const imageUrl = normalizeImageUrlForSeo(game.cover, origin);

  /** @type {Record<string, any>} */
  const videoGame = {
    "@type": "VideoGame",
    name: name || "Untitled Retro Game",
    url: url || origin || "",
  };

  if (platform) {
    videoGame.gamePlatform = platform;
  }

  if (genreList && genreList.length) {
    videoGame.genre = genreList;
  }

  videoGame.description = `${name || "Untitled"} on ${platform || "Unknown Platform"} tracked in the Dragon's Hoard Atlas.`;

  if (releaseYear) {
    videoGame.datePublished = `${releaseYear}-01-01`;
  }

  if (imageUrl) {
    videoGame.image = imageUrl;
  }

  if (typeof rating === "number") {
    videoGame.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: rating,
      bestRating: "10",
      worstRating: "0",
      ratingCount: 1,
    };

    const today = new Date().toISOString().split("T")[0];
    videoGame.review = {
      "@type": "Review",
      name: `${name} community rating`,
      author: {
        "@type": "Organization",
        name: "Dragon's Hoard Atlas",
      },
      datePublished: today,
      reviewBody: `${name} on ${platform} earns a ${rating}/10 score from collectors.`,
      reviewRating: {
        "@type": "Rating",
        ratingValue: rating,
        bestRating: "10",
        worstRating: "0",
      },
    };
  }

  return videoGame;
}

// === Structured Data Generation ===

/**
 * Build the complete JSON-LD structured data payload.
 * @param {Object[]} games - Array of game objects
 * @param {string} [origin=''] - Site origin URL
 * @returns {Object|null} JSON-LD payload or null if no candidates
 */
export function buildStructuredDataPayload(games, origin = "") {
  const featured = getStructuredDataCandidates(games, STRUCTURED_DATA_LIMIT);
  if (!featured.length) return null;

  const listItems = featured.map((entry, index) => {
    const videoGame = mapGameToVideoGameSchema(entry, origin);
    return {
      "@type": "ListItem",
      position: index + 1,
      url: videoGame.url,
      item: videoGame,
    };
  });

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Dragon's Hoard Atlas – Collector Spotlight",
    description:
      "Curated retro highlights with platform, genre, and community rating data.",
    itemListElement: listItems,
  };
}

// === DOM Injection ===

/**
 * Inject or update JSON-LD structured data in the document head.
 * @param {Object[]} games - Array of game objects
 * @returns {boolean} True if structured data was injected
 */
export function updateStructuredData(games) {
  if (
    !Array.isArray(games) ||
    !games.length ||
    typeof document === "undefined" ||
    typeof JSON === "undefined"
  ) {
    return false;
  }

  const origin =
    typeof window !== "undefined" && window.location && window.location.origin
      ? window.location.origin.replace(/\/$/, "")
      : "";

  const payload = buildStructuredDataPayload(games, origin);
  if (!payload) return false;

  let script = document.getElementById(STRUCTURED_DATA_ID);
  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = STRUCTURED_DATA_ID;
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(payload, null, 2);
  return true;
}

/**
 * Remove structured data from the document.
 * @returns {boolean} True if element was removed
 */
export function removeStructuredData() {
  if (typeof document === "undefined") return false;

  const script = document.getElementById(STRUCTURED_DATA_ID);
  if (script) {
    script.remove();
    return true;
  }
  return false;
}
