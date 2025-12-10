#!/usr/bin/env node

/**
 * Fetch Cover Art Script
 * Discovers cover art URLs from Wikipedia for games missing covers.
 * Updates Supabase and optionally syncs to local JSON.
 *
 * Usage:
 *   node scripts/fetch-covers.js [options]
 *
 * Options:
 *   --limit <n>       Maximum games to process (default: 50)
 *   --dry-run         Preview changes without updating Supabase
 *   --output <path>   Write results to JSON file
 *   --force           Re-fetch covers even if already present
 *
 * Environment:
 *   SUPABASE_URL              Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY Service role key for writes
 *
 * @module scripts/fetch-covers
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_PATH = path.resolve(__dirname, "../data/cover-cache.json");
const MANUAL_COVERS_PATH = path.resolve(__dirname, "../data/manual-covers.json");
const RATE_LIMIT_MS = 200; // Wikipedia rate limit: 200 req/sec, we go slower

/**
 * Parse command-line arguments.
 * @param {string[]} argv - Command line arguments
 * @returns {Object} Parsed options
 */
function parseArgs(argv) {
  const options = {
    limit: 50,
    dryRun: false,
    output: null,
    force: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--limit" && argv[i + 1]) {
      options.limit = parseInt(argv[i + 1], 10) || 50;
      i += 1;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if ((arg === "--output" || arg === "-o") && argv[i + 1]) {
      options.output = path.resolve(argv[i + 1]);
      i += 1;
    } else if (arg === "--force") {
      options.force = true;
    }
  }
  return options;
}

/**
 * Ensure fetch is available.
 * @returns {Promise<Function>} Fetch implementation
 */
async function ensureFetch() {
  if (typeof fetch === "function") return fetch;
  const { default: fetchImpl } = await import("node-fetch");
  return fetchImpl;
}

/**
 * Sleep for specified milliseconds.
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Load cache from disk.
 * @returns {Object} Cache object
 */
function loadCache() {
  try {
    if (fs.existsSync(CACHE_PATH)) {
      return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    }
  } catch {
    // Ignore cache errors
  }
  return { hits: {}, misses: {} };
}

/**
 * Save cache to disk.
 * @param {Object} cache - Cache object
 */
function saveCache(cache) {
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch {
    // Ignore cache errors
  }
}

/**
 * Load manual cover mappings from disk.
 * @returns {Object} Manual mappings object
 */
function loadManualCovers() {
  try {
    if (fs.existsSync(MANUAL_COVERS_PATH)) {
      const data = JSON.parse(fs.readFileSync(MANUAL_COVERS_PATH, "utf8"));
      return data.mappings || {};
    }
  } catch {
    // Ignore errors
  }
  return {};
}

/**
 * Normalize game name for Wikipedia search.
 * @param {string} name - Game name
 * @returns {string} Normalized name
 */
function normalizeGameName(name) {
  return name
    .replace(/\s*-\s*/g, " ") // Replace hyphens with spaces
    .replace(/[\u2018\u2019]/g, "'") // Normalize curly single quotes to straight
    .replace(/[\u201C\u201D]/g, '"') // Normalize curly double quotes to straight
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
}

/**
 * Build Wikipedia search queries for a game.
 * @param {string} gameName - Game name
 * @param {string} platform - Platform name
 * @returns {string[]} Search queries to try
 */
function buildSearchQueries(gameName, platform) {
  const normalized = normalizeGameName(gameName);
  const queries = [];

  // Most specific first - include platform context
  if (platform && platform !== "N/A") {
    queries.push(`${normalized} (${getPlatformAlias(platform)} video game)`);
  }

  // Standard video game query
  queries.push(`${normalized} (video game)`);
  queries.push(`${normalized} video game`);

  // For classic games, try year-based queries
  const platformYears = {
    NES: "1986",
    SNES: "1991",
    "Game Boy": "1989",
    "Sega Genesis": "1989",
    Arcade: "1980",
    N64: "1996",
    PS1: "1995",
  };
  if (platformYears[platform]) {
    queries.push(`${normalized} (${platformYears[platform]} video game)`);
  }

  // For arcade games, add arcade-specific search
  if (platform === "Arcade") {
    queries.push(`${normalized} (arcade game)`);
    queries.push(`${normalized} arcade`);
  }

  // Generic fallback
  queries.push(normalized);

  // Add variations for common patterns
  if (normalized.includes("III")) {
    queries.push(`${normalized.replace("III", "3")} (video game)`);
  }
  if (normalized.includes("II") && !normalized.includes("III")) {
    queries.push(`${normalized.replace("II", "2")} (video game)`);
  }

  return queries;
}

/**
 * Get platform alias for search.
 * @param {string} platform - Platform name
 * @returns {string} Platform alias
 */
function getPlatformAlias(platform) {
  const aliases = {
    SNES: "Super Nintendo",
    NES: "Nintendo Entertainment System",
    "Game Boy Advance": "GBA",
    "Game Boy": "Nintendo",
    N64: "Nintendo 64",
    PS1: "PlayStation",
    PS2: "PlayStation 2",
    "Sega Genesis": "Genesis",
    "Sega Saturn": "Sega",
    "Neo Geo": "Neo Geo",
    Arcade: "arcade",
    "Nintendo DS": "Nintendo DS",
    Wii: "Wii",
    PC: "PC",
    "PC (DOS)": "DOS",
  };
  return aliases[platform] || platform;
}

/**
 * Fetch cover image URL from Wikipedia.
 * @param {Function} fetchImpl - Fetch implementation
 * @param {string} gameName - Game name
 * @param {string} platform - Platform name
 * @returns {Promise<string|null>} Cover URL or null
 */
async function fetchWikipediaCover(fetchImpl, gameName, platform) {
  const queries = buildSearchQueries(gameName, platform);

  for (const query of queries) {
    try {
      // First, search for the page
      const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
      const searchResponse = await fetchImpl(searchUrl, {
        headers: {
          "User-Agent": "RetroGamesList/1.0 (https://github.com/sandgraal/retro-games)",
        },
      });

      if (searchResponse.ok) {
        const data = await searchResponse.json();

        // Check for originalimage (high-res cover)
        if (data.originalimage?.source) {
          const url = data.originalimage.source;
          if (isValidCoverUrl(url)) {
            return url;
          }
        }

        // Fall back to thumbnail
        if (data.thumbnail?.source) {
          // Try to get higher resolution version
          const thumbUrl = data.thumbnail.source;
          const highResUrl = thumbUrl.replace(/\/\d+px-/, "/300px-");
          if (isValidCoverUrl(highResUrl)) {
            return highResUrl;
          }
          if (isValidCoverUrl(thumbUrl)) {
            return thumbUrl;
          }
        }
      }

      await sleep(RATE_LIMIT_MS);
    } catch {
      // Continue to next query
    }
  }

  return null;
}

/**
 * Check if URL is a valid cover image URL.
 * @param {string} url - URL to check
 * @returns {boolean} True if valid
 */
function isValidCoverUrl(url) {
  if (!url || typeof url !== "string") return false;
  if (!/^https?:\/\//i.test(url)) return false;
  // Ensure it's an image
  if (!/\.(jpg|jpeg|png|gif|webp)/i.test(url)) return false;
  // Reject SVG (often logos, not covers)
  if (/\.svg/i.test(url)) return false;
  // Reject obvious non-cover images
  if (/flag|map|logo|icon|banner|screenshot/i.test(url.toLowerCase())) return false;
  return true;
}

/**
 * Check if game is a region variant that should be skipped.
 * @param {Object} game - Game object
 * @returns {boolean} True if should skip
 */
function isRegionVariant(game) {
  // Skip games with N/A platform (region-specific entries)
  if (game.platform === "N/A") return true;

  // Skip games with region/translation in name
  const regionPatterns = [
    /\((?:USA|Europe|Japan|PAL|NTSC|Translated En)\)\s*$/i,
    /\((?:USA|Europe|Japan|PAL|NTSC|Translated En)\)\s*\([^)]+\)\s*$/i,
  ];
  for (const pattern of regionPatterns) {
    if (pattern.test(game.game_name)) return true;
  }

  return false;
}

/**
 * Load games from Supabase that need covers.
 * @param {Function} fetchImpl - Fetch implementation
 * @param {Object} options - Options
 * @returns {Promise<Array>} Games needing covers
 */
async function loadGamesNeedingCovers(fetchImpl, options) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error(
      "❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) required"
    );
    process.exit(1);
  }

  // Build query - get games without valid cover URLs
  let queryUrl = `${url}/rest/v1/games?select=id,game_name,platform,cover&order=game_name.asc`;

  if (!options.force) {
    // Only get games with null or invalid covers
    queryUrl += "&or=(cover.is.null,cover.not.ilike.http*)";
  }

  queryUrl += `&limit=${options.limit}`;

  const response = await fetchImpl(queryUrl, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to load games: ${response.status} ${text}`);
  }

  return response.json();
}

/**
 * Update game cover in Supabase.
 * @param {Function} fetchImpl - Fetch implementation
 * @param {number} gameId - Game ID
 * @param {string} coverUrl - Cover URL
 * @returns {Promise<boolean>} Success
 */
async function updateGameCover(fetchImpl, gameId, coverUrl) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL and key required for updates");
  }

  const response = await fetchImpl(`${url}/rest/v1/games?id=eq.${gameId}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ cover: coverUrl }),
  });

  return response.ok;
}

/**
 * Main entry point.
 */
async function main() {
  const options = parseArgs(process.argv.slice(2));
  const fetchImpl = await ensureFetch();

  console.log("🎮 Retro Games Cover Fetcher");
  console.log("============================");
  console.log(
    `Options: limit=${options.limit}, dryRun=${options.dryRun}, force=${options.force}`
  );
  console.log("");

  // Load cache
  const cache = loadCache();
  console.log(
    `Cache: ${Object.keys(cache.hits).length} hits, ${Object.keys(cache.misses).length} misses`
  );

  // Load manual cover mappings
  const manualCovers = loadManualCovers();
  console.log(`Manual covers: ${Object.keys(manualCovers).length} mappings`);

  // Load games
  console.log("Loading games from Supabase...");
  let games;
  try {
    games = await loadGamesNeedingCovers(fetchImpl, options);
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }

  console.log(`Found ${games.length} games needing covers`);
  console.log("");

  const results = {
    processed: 0,
    found: 0,
    notFound: 0,
    updated: 0,
    errors: 0,
    skipped: 0,
    covers: [],
  };

  // Process each game
  for (const game of games) {
    const key = `${game.game_name}___${game.platform}`;

    // Skip region variants
    if (isRegionVariant(game)) {
      console.log(`Skipping: ${game.game_name} (${game.platform}) - region variant`);
      results.skipped += 1;
      continue;
    }

    console.log(`Processing: ${game.game_name} (${game.platform})`);

    // Check manual covers first (highest priority)
    if (manualCovers[key]) {
      console.log(`  ✓ Manual mapping: ${manualCovers[key]}`);
      results.covers.push({
        id: game.id,
        game_name: game.game_name,
        platform: game.platform,
        cover: manualCovers[key],
        source: "manual",
      });
      results.found += 1;

      // Also update cache for future runs
      cache.hits[key] = manualCovers[key];
      // Remove from misses if present
      delete cache.misses[key];

      if (!options.dryRun) {
        try {
          await updateGameCover(fetchImpl, game.id, manualCovers[key]);
          results.updated += 1;
          console.log(`  ✓ Updated in Supabase`);
        } catch (err) {
          console.log(`  ⚠ Failed to update: ${err.message}`);
          results.errors += 1;
        }
      }

      results.processed += 1;
      continue;
    }

    // Check cache
    if (cache.hits[key]) {
      console.log(`  ✓ Cached: ${cache.hits[key]}`);
      results.covers.push({
        id: game.id,
        game_name: game.game_name,
        platform: game.platform,
        cover: cache.hits[key],
        source: "cache",
      });
      results.found += 1;

      if (!options.dryRun) {
        try {
          await updateGameCover(fetchImpl, game.id, cache.hits[key]);
          results.updated += 1;
          console.log(`  ✓ Updated in Supabase`);
        } catch (err) {
          console.log(`  ⚠ Failed to update: ${err.message}`);
          results.errors += 1;
        }
      }

      results.processed += 1;
      continue;
    }

    // Check negative cache
    if (cache.misses[key]) {
      console.log(`  ✗ Previously not found (cached)`);
      results.notFound += 1;
      results.processed += 1;
      continue;
    }

    // Fetch from Wikipedia
    const coverUrl = await fetchWikipediaCover(fetchImpl, game.game_name, game.platform);

    if (coverUrl) {
      console.log(`  ✓ Found: ${coverUrl}`);
      cache.hits[key] = coverUrl;
      results.covers.push({
        id: game.id,
        game_name: game.game_name,
        platform: game.platform,
        cover: coverUrl,
        source: "wikipedia",
      });
      results.found += 1;

      if (!options.dryRun) {
        try {
          await updateGameCover(fetchImpl, game.id, coverUrl);
          results.updated += 1;
          console.log(`  ✓ Updated in Supabase`);
        } catch (err) {
          console.log(`  ⚠ Failed to update: ${err.message}`);
          results.errors += 1;
        }
      }
    } else {
      console.log(`  ✗ Not found`);
      cache.misses[key] = Date.now();
      results.notFound += 1;
    }

    results.processed += 1;
    await sleep(RATE_LIMIT_MS);
  }

  // Save cache
  saveCache(cache);

  // Print summary
  console.log("");
  console.log("============================");
  console.log("Summary");
  console.log("============================");
  console.log(`Processed: ${results.processed}`);
  console.log(`Found:     ${results.found}`);
  console.log(`Not found: ${results.notFound}`);
  console.log(`Skipped:   ${results.skipped}`);
  console.log(`Updated:   ${results.updated}`);
  console.log(`Errors:    ${results.errors}`);

  if (options.dryRun) {
    console.log("");
    console.log("(dry-run mode - no changes made)");
  }

  // Write output file
  if (options.output) {
    const outputData = {
      timestamp: new Date().toISOString(),
      options,
      ...results,
    };
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, JSON.stringify(outputData, null, 2));
    console.log(`Results written to: ${options.output}`);
  }

  // Generate SQL statements for manual import
  if (results.covers.length > 0 && results.errors > 0) {
    const sqlPath = path.resolve(__dirname, "../data/cover-updates.sql");
    const sqlStatements = results.covers
      .map(
        (c) =>
          `UPDATE games SET cover = '${c.cover.replace(/'/g, "''")}' WHERE id = ${c.id};`
      )
      .join("\n");
    fs.writeFileSync(
      sqlPath,
      `-- Cover updates generated ${new Date().toISOString()}\n${sqlStatements}\n`
    );
    console.log(`SQL statements written to: ${sqlPath}`);
  }
}

// Export for testing
module.exports = {
  parseArgs,
  normalizeGameName,
  buildSearchQueries,
  isValidCoverUrl,
};

// Run if executed directly
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
