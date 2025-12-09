#!/usr/bin/env node

/**
 * Audit Missing Covers Script
 * Lists games with missing or invalid cover URLs from the dataset.
 * Outputs to console and optionally to a JSON file for tracking.
 *
 * Usage:
 *   node scripts/audit-missing-covers.js [--source supabase|json] [--output <path>]
 *
 * Options:
 *   --source   Data source: 'supabase' or 'json' (default: json)
 *   --output   Path to write results JSON (optional)
 *
 * @module scripts/audit-missing-covers
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SAMPLE_DATA_PATH = path.resolve(__dirname, "../data/sample-games.json");

/**
 * Parse command-line arguments.
 * @param {string[]} argv - Command line arguments
 * @returns {Object} Parsed options
 */
function parseArgs(argv) {
  const options = {
    source: "json",
    output: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--source" && argv[i + 1]) {
      options.source = argv[i + 1].toLowerCase();
      i += 1;
    } else if ((arg === "--output" || arg === "-o") && argv[i + 1]) {
      options.output = path.resolve(argv[i + 1]);
      i += 1;
    }
  }
  return options;
}

/**
 * Check if a cover URL is valid.
 * @param {*} cover - Cover field value
 * @returns {boolean} True if valid URL
 */
function isValidCoverUrl(cover) {
  if (!cover) return false;
  if (typeof cover !== "string") return false;
  const trimmed = cover.trim();
  if (!trimmed) return false;
  return /^https?:\/\/.+/i.test(trimmed);
}

/**
 * Categorize the cover issue type.
 * @param {*} cover - Cover field value
 * @returns {string} Issue category
 */
function categorizeIssue(cover) {
  if (cover === undefined) return "missing";
  if (cover === null) return "null";
  if (cover === "") return "empty";
  if (typeof cover !== "string") return "invalid-type";
  if (!/^https?:\/\//i.test(cover.trim())) return "invalid-url";
  return "unknown";
}

/**
 * Load games from JSON file.
 * @returns {Promise<Array>} Games array
 */
async function loadFromJson() {
  const data = fs.readFileSync(SAMPLE_DATA_PATH, "utf8");
  const parsed = JSON.parse(data);
  return Array.isArray(parsed) ? parsed : parsed.games || [];
}

/**
 * Load games from Supabase.
 * @returns {Promise<Array>} Games array
 */
async function loadFromSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY required for Supabase source");
  }

  const fetchImpl = await ensureFetch();
  const response = await fetchImpl(`${url}/rest/v1/games?select=*&order=game_name.asc`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${text}`);
  }

  return response.json();
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
 * Audit games for missing covers.
 * @param {Array} games - Games array
 * @returns {Object} Audit results
 */
function auditCovers(games) {
  const issues = [];
  const stats = {
    total: games.length,
    withCover: 0,
    missing: 0,
    null: 0,
    empty: 0,
    invalidType: 0,
    invalidUrl: 0,
  };

  for (const game of games) {
    if (isValidCoverUrl(game.cover)) {
      stats.withCover += 1;
    } else {
      const issueType = categorizeIssue(game.cover);
      stats[issueType === "invalid-type" ? "invalidType" : issueType] += 1;
      if (issueType === "invalid-url") {
        stats.invalidUrl += 1;
      }
      issues.push({
        game_name: game.game_name || "(unknown)",
        platform: game.platform || "(unknown)",
        issue: issueType,
        currentValue: game.cover ?? null,
      });
    }
  }

  // Sort issues by game name
  issues.sort((a, b) => a.game_name.localeCompare(b.game_name));

  return { stats, issues };
}

/**
 * Format audit results for console output.
 * @param {Object} results - Audit results
 * @returns {string} Formatted output
 */
function formatResults(results) {
  const { stats, issues } = results;
  const lines = [];

  lines.push("=".repeat(60));
  lines.push("Cover Audit Report");
  lines.push("=".repeat(60));
  lines.push("");
  lines.push("Summary:");
  lines.push(`  Total games:      ${stats.total}`);
  lines.push(
    `  With valid cover: ${stats.withCover} (${((stats.withCover / stats.total) * 100).toFixed(1)}%)`
  );
  lines.push(`  Missing cover:    ${stats.missing}`);
  lines.push(`  Null value:       ${stats.null}`);
  lines.push(`  Empty string:     ${stats.empty}`);
  lines.push(`  Invalid type:     ${stats.invalidType}`);
  lines.push(`  Invalid URL:      ${stats.invalidUrl}`);
  lines.push("");

  if (issues.length > 0) {
    lines.push("-".repeat(60));
    lines.push("Games with cover issues:");
    lines.push("-".repeat(60));
    for (const issue of issues) {
      lines.push(`  ${issue.game_name} (${issue.platform}) - ${issue.issue}`);
    }
  } else {
    lines.push("✓ All games have valid cover URLs!");
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Main entry point.
 */
async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log(`Loading games from ${options.source}...`);

  let games;
  try {
    if (options.source === "supabase") {
      games = await loadFromSupabase();
    } else {
      games = await loadFromJson();
    }
  } catch (err) {
    console.error(`Failed to load games: ${err.message}`);
    process.exit(1);
  }

  console.log(`Loaded ${games.length} games.`);
  console.log("");

  const results = auditCovers(games);
  console.log(formatResults(results));

  if (options.output) {
    const outputData = {
      timestamp: new Date().toISOString(),
      source: options.source,
      ...results,
    };
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, JSON.stringify(outputData, null, 2));
    console.log(`Results written to: ${options.output}`);
  }

  // Exit with error code if issues found
  if (results.issues.length > 0) {
    process.exit(1);
  }
}

// Export functions for testing
module.exports = {
  parseArgs,
  isValidCoverUrl,
  categorizeIssue,
  auditCovers,
  formatResults,
};

// Run if executed directly
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
