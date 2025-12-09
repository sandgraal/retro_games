#!/usr/bin/env node

/**
 * Enrich Game Data Script
 * Fetches missing metadata (descriptions, developers, publishers, release years)
 * from Wikipedia and other sources for games in the Supabase database.
 *
 * Usage:
 *   node scripts/enrich-game-data.js [options]
 *
 * Options:
 *   --limit <n>       Maximum games to process (default: 25)
 *   --dry-run         Preview changes without updating Supabase
 *   --output <path>   Write results to JSON file
 *   --canonical-only  Only process canonical games (not regional variants)
 *
 * Environment:
 *   SUPABASE_URL              Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY Service role key for writes
 *
 * @module scripts/enrich-game-data
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_PATH = path.resolve(__dirname, "../data/enrichment-cache.json");
const RATE_LIMIT_MS = 500; // Be respectful to Wikipedia

/**
 * Parse command-line arguments.
 * @param {string[]} argv - Command line arguments
 * @returns {Object} Parsed options
 */
function parseArgs(argv) {
  const options = {
    limit: 25,
    dryRun: false,
    output: null,
    canonicalOnly: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--limit" && argv[i + 1]) {
      options.limit = Number.parseInt(argv[i + 1], 10) || 25;
      i++;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if ((arg === "--output" || arg === "-o") && argv[i + 1]) {
      options.output = path.resolve(argv[i + 1]);
      i++;
    } else if (arg === "--all-games") {
      options.canonicalOnly = false;
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
  return { hits: {}, misses: {}, lastUpdated: null };
}

/**
 * Save cache to disk.
 * @param {Object} cache - Cache object
 */
function saveCache(cache) {
  try {
    cache.lastUpdated = new Date().toISOString();
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch (err) {
    console.warn("Failed to save cache:", err.message);
  }
}

/**
 * Clean game name for Wikipedia search.
 * @param {string} name - Game name
 * @returns {string} Cleaned search query
 */
function cleanGameName(name) {
  // Remove region suffixes
  return name
    .replaceAll(/\s*\((USA|Japan|Europe|Translated\s+En)\)/gi, "")
    .replaceAll(/\s*\(NES\)/gi, " NES")
    .replaceAll(/\s*\(PS1\)/gi, "")
    .trim();
}

/**
 * Map platform to Wikipedia-friendly format.
 * @param {string} platform - Platform name
 * @returns {string} Wikipedia-friendly platform
 */
function platformToWikiFormat(platform) {
  const mapping = {
    SNES: "Super Nintendo",
    NES: "NES",
    N64: "Nintendo 64",
    PS1: "PlayStation",
    PS2: "PlayStation 2",
    "Sega Genesis": "Sega Genesis",
    "Game Boy Advance": "Game Boy Advance",
    "Game Boy": "Game Boy",
    "Game Boy Color": "Game Boy Color",
    "Nintendo DS": "Nintendo DS",
    Arcade: "arcade game",
    PC: "video game",
    "PC (DOS)": "DOS",
    "Neo Geo": "Neo Geo",
    "Sega Saturn": "Sega Saturn",
    "Sega Dreamcast": "Dreamcast",
    Xbox: "Xbox",
    Wii: "Wii",
    "PC Engine/TurboGrafx-16": "TurboGrafx-16",
  };
  return mapping[platform] || platform;
}

/**
 * Fetch game info from Wikipedia.
 * @param {Function} fetchFn - Fetch function
 * @param {string} gameName - Game name
 * @param {string} platform - Platform
 * @returns {Promise<Object|null>} Extracted game info or null
 */
async function fetchWikipediaInfo(fetchFn, gameName, platform) {
  const cleaned = cleanGameName(gameName);
  const wikiPlatform = platformToWikiFormat(platform);

  // Try multiple search queries
  const queries = [`${cleaned} (video game)`, `${cleaned} (${wikiPlatform})`, cleaned];

  for (const query of queries) {
    try {
      // Wikipedia API - search for page
      const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
      const response = await fetchFn(searchUrl, {
        headers: {
          "User-Agent": "DragonHoardAtlas/1.0 (https://github.com/sandgraal/retro-games)",
        },
      });

      if (response.ok) {
        const data = await response.json();

        // Extract structured data from the summary
        const info = {
          description: data.extract || null,
          wikiUrl: data.content_urls?.desktop?.page || null,
          title: data.title,
        };

        // Try to extract developer/publisher from the extract
        const extract = data.extract || "";

        // Common patterns in Wikipedia game articles
        const developerMatch = extract.match(
          /developed by\s+([A-Z][^.]+?)(?:\s+and\s+published|\s+for|\.|,)/i
        );
        const publisherMatch = extract.match(
          /published by\s+([A-Z][^.]+?)(?:\s+for|\s+in|\.|,)/i
        );
        const yearMatch = extract.match(
          /released\s+(?:in\s+)?(\d{4})|(\d{4})\s+(?:video\s+)?game/i
        );

        if (developerMatch) {
          info.developer = developerMatch[1].trim();
        }
        if (publisherMatch) {
          info.publisher = publisherMatch[1].trim();
        }
        if (yearMatch) {
          info.release_year = Number.parseInt(yearMatch[1] || yearMatch[2], 10);
        }

        // Only return if we got useful data
        if (info.description && info.description.length > 50) {
          return info;
        }
      }
    } catch {
      // Continue to next query
    }
    await sleep(RATE_LIMIT_MS);
  }

  return null;
}

/**
 * Create Supabase client.
 * @param {Function} fetchFn - Fetch function
 * @returns {Object} Supabase-like client
 */
function createSupabaseClient(fetchFn) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  return {
    async select(query) {
      const response = await fetchFn(`${url}/rest/v1/games?${query}`, {
        headers,
      });
      if (!response.ok) {
        throw new Error(`Supabase select failed: ${response.statusText}`);
      }
      return response.json();
    },
    async update(id, data) {
      const response = await fetchFn(`${url}/rest/v1/games?id=eq.${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error(`Supabase update failed: ${response.statusText}`);
      }
      return response.json();
    },
  };
}

/**
 * Main enrichment function.
 */
async function main() {
  const options = parseArgs(process.argv.slice(2));
  const fetchFn = await ensureFetch();

  console.log("🎮 Game Data Enrichment Script");
  console.log("================================");
  console.log(`Options: limit=${options.limit}, dryRun=${options.dryRun}`);

  const cache = loadCache();
  const results = {
    processed: 0,
    enriched: 0,
    failed: 0,
    skipped: 0,
    games: [],
  };

  try {
    const supabase = createSupabaseClient(fetchFn);

    // Query games missing enrichment data
    let query = `select=id,game_name,platform,description,developer,publisher,release_year,is_canonical`;

    // Filter to games missing key data
    query += `&or=(description.is.null,developer.is.null,publisher.is.null)`;

    if (options.canonicalOnly) {
      query += `&is_canonical=eq.true`;
    }

    query += `&limit=${options.limit}&order=game_name.asc`;

    console.log("\n📥 Fetching games needing enrichment...");
    const games = await supabase.select(query);
    console.log(`Found ${games.length} games to process`);

    for (const game of games) {
      const cacheKey = `${game.game_name}___${game.platform}`.toLowerCase();

      // Check cache for recent misses
      if (cache.misses[cacheKey]) {
        const missDate = new Date(cache.misses[cacheKey]);
        const daysSinceMiss = (Date.now() - missDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceMiss < 7) {
          console.log(`⏭️  Skipping (cached miss): ${game.game_name}`);
          results.skipped += 1;
          continue;
        }
      }

      // Check cache for hits
      if (cache.hits[cacheKey]) {
        console.log(`✅ Using cached data: ${game.game_name}`);
        const cachedData = cache.hits[cacheKey];

        if (!options.dryRun) {
          await supabase.update(game.id, {
            ...cachedData,
            updated_at: new Date().toISOString(),
          });
        }
        results.enriched += 1;
        results.games.push({ ...game, ...cachedData, source: "cache" });
        continue;
      }

      console.log(`🔍 Looking up: ${game.game_name} (${game.platform})`);
      results.processed += 1;

      const info = await fetchWikipediaInfo(fetchFn, game.game_name, game.platform);

      if (info) {
        const updateData = {};

        if (!game.description && info.description) {
          // Truncate description to first 2-3 sentences
          const sentences = info.description.split(/\.\s+/);
          updateData.description = sentences.slice(0, 3).join(". ") + ".";
        }
        if (!game.developer && info.developer) {
          updateData.developer = info.developer;
        }
        if (!game.publisher && info.publisher) {
          updateData.publisher = info.publisher;
        }
        if (!game.release_year && info.release_year) {
          updateData.release_year = info.release_year;
        }

        if (Object.keys(updateData).length > 0) {
          console.log(`  ✅ Found: ${Object.keys(updateData).join(", ")}`);

          if (!options.dryRun) {
            await supabase.update(game.id, {
              ...updateData,
              updated_at: new Date().toISOString(),
            });
          }

          cache.hits[cacheKey] = updateData;
          results.enriched += 1;
          results.games.push({
            ...game,
            ...updateData,
            source: "wikipedia",
            wikiUrl: info.wikiUrl,
          });
        } else {
          console.log(`  ⚠️  No new data found`);
          cache.misses[cacheKey] = new Date().toISOString();
          results.failed += 1;
        }
      } else {
        console.log(`  ❌ No Wikipedia page found`);
        cache.misses[cacheKey] = new Date().toISOString();
        results.failed += 1;
      }

      await sleep(RATE_LIMIT_MS);
    }

    // Propagate enriched data to variants
    if (!options.dryRun && results.enriched > 0) {
      console.log("\n📤 Propagating data to regional variants...");
      // This is handled by the database migration we already applied
    }

    saveCache(cache);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }

  // Summary
  console.log("\n📊 Summary");
  console.log("===========");
  console.log(`Processed: ${results.processed}`);
  console.log(`Enriched:  ${results.enriched}`);
  console.log(`Failed:    ${results.failed}`);
  console.log(`Skipped:   ${results.skipped}`);

  if (options.output) {
    fs.writeFileSync(options.output, JSON.stringify(results, null, 2));
    console.log(`\nResults written to: ${options.output}`);
  }

  if (options.dryRun) {
    console.log("\n⚠️  Dry run - no changes were made");
  }
}

await main();
