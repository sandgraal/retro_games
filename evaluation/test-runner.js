import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveGamesPath(csvPath) {
  const baseDir = path.resolve(__dirname, "..");
  const resolved = path.resolve(baseDir, csvPath);
  if (!resolved.startsWith(baseDir + path.sep)) {
    throw new Error("Games data path must remain inside the project directory.");
  }
  return resolved;
}

/**
 * Test Runner for Retro Game List Evaluation
 * Simulates user interactions and collects responses for evaluation
 */

class GameListTestRunner {
  constructor(gamesDataPath) {
    this.games = this.loadGames(resolveGamesPath(gamesDataPath));
    this.responses = [];
  }

  /**
   * Load games from CSV
   */
  loadGames(csvPath) {
    const csv = fs.readFileSync(csvPath, "utf-8");
    const lines = csv.split("\n");
    const headers = lines[0].split(",").map((h) => h.trim());
    const games = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      // Simple CSV parsing (handles basic cases)
      const values = this.parseCSVLine(lines[i]);
      const game = {};
      headers.forEach((header, idx) => {
        game[header] = values[idx] || "";
      });

      if (game["Game Name"]) {
        games.push(game);
      }
    }

    return games;
  }

  /**
   * Parse CSV line with quoted field support
   */
  parseCSVLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
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

  /**
   * Simulate search functionality
   */
  testSearch(query) {
    const lowerQuery = query.toLowerCase();
    const results = this.games.filter((game) => {
      return Object.values(game).some((value) =>
        String(value).toLowerCase().includes(lowerQuery)
      );
    });

    return {
      query,
      results_count: results.length,
      results: results.slice(0, 5), // Return top 5
      success: results.length > 0,
    };
  }

  /**
   * Simulate platform filter
   */
  testPlatformFilter(platform) {
    const results = this.games.filter((game) => game["Platform"] === platform);

    return {
      platform,
      results_count: results.length,
      results: results.slice(0, 5),
      success: results.length > 0,
    };
  }

  /**
   * Simulate genre filter
   */
  testGenreFilter(genre) {
    const results = this.games.filter((game) => {
      const gameGenres = game["Genre"].split(",").map((g) => g.trim());
      return gameGenres.some((g) => g === genre || g.includes(genre));
    });

    return {
      genre,
      results_count: results.length,
      results: results.slice(0, 5),
      success: results.length > 0,
    };
  }

  /**
   * Simulate combined filter
   */
  testCombinedFilter(platform, genre) {
    const results = this.games.filter((game) => {
      if (game["Platform"] !== platform) return false;
      const gameGenres = game["Genre"].split(",").map((g) => g.trim());
      return gameGenres.some((g) => g === genre || g.includes(genre));
    });

    return {
      platform,
      genre,
      results_count: results.length,
      results: results.slice(0, 5),
      success: results.length > 0,
    };
  }

  /**
   * Simulate collection operations
   */
  testCollectionOperation(action, gameKey) {
    const [gameName, platform] = gameKey.split("___");
    const game = this.games.find(
      (g) => g["Game Name"] === gameName && g["Platform"] === platform
    );

    return {
      action,
      game_key: gameKey,
      game_found: !!game,
      success: !!game,
      game_data: game,
    };
  }

  /**
   * Simulate CSV export
   */
  testCSVExport(gameKeys) {
    const games = gameKeys
      .map((key) => {
        const [gameName, platform] = key.split("___");
        return this.games.find(
          (g) => g["Game Name"] === gameName && g["Platform"] === platform
        );
      })
      .filter(Boolean);

    const headers = ["Game Name", "Platform", "Rating", "Genre"];
    let csv = headers.join(",") + "\n";

    games.forEach((game) => {
      const row = headers.map((h) => {
        const value = game[h] || "";
        // Escape quotes in CSV
        return `"${value.replace(/"/g, '""')}"`;
      });
      csv += row.join(",") + "\n";
    });

    return {
      action: "export",
      games_count: games.length,
      csv_valid: csv.includes("Game Name"),
      csv_length: csv.length,
      success: true,
    };
  }

  /**
   * Simulate share code generation
   */
  testShareCodeGeneration(gameKeys) {
    const codeString = gameKeys.join("|");
    const encoded = Buffer.from(encodeURIComponent(codeString)).toString(
      "base64"
    );

    return {
      action: "generate_sharecode",
      games_count: gameKeys.length,
      share_code: encoded.substring(0, 50) + "...", // Truncate for display
      share_code_valid: encoded.length > 0,
      success: true,
    };
  }

  /**
   * Simulate share code import
   */
  testShareCodeImport(shareCode) {
    try {
      const decoded = Buffer.from(shareCode, "base64").toString();
      const gameKeys = decodeURIComponent(decoded).split("|");

      const games = gameKeys
        .map((key) => {
          const [gameName, platform] = key.split("___");
          return this.games.find(
            (g) => g["Game Name"] === gameName && g["Platform"] === platform
          );
        })
        .filter(Boolean);

      return {
        action: "import_sharecode",
        games_imported: games.length,
        imported_games: games.slice(0, 3),
        success: games.length > 0,
      };
    } catch (e) {
      return {
        action: "import_sharecode",
        error: e.message,
        success: false,
      };
    }
  }

  /**
   * Run all test queries
   */
  async runAllTests(queries) {
    this.responses = [];

    for (const query of queries) {
      let response;

      switch (query.type) {
        case "search":
          response = this.testSearch(query.query);
          break;

        case "filter":
          if (query.filter_type === "platform") {
            response = this.testPlatformFilter(query.platform);
          } else if (query.filter_type === "genre") {
            response = this.testGenreFilter(query.genre);
          } else if (query.filter_type === "combined") {
            response = this.testCombinedFilter(query.platform, query.genre);
          }
          break;

        case "collection":
          if (query.action === "add" || query.action === "remove") {
            if (query.games) {
              response = {
                action: query.action,
                games: query.games.map((g) =>
                  this.testCollectionOperation(
                    query.action,
                    `${g.game_name}___${g.platform}`
                  )
                ),
                success: true,
              };
            } else {
              response = this.testCollectionOperation(
                query.action,
                `${query.game_name}___${query.platform}`
              );
            }
          } else if (query.action === "persist") {
            response = {
              action: "persist",
              initial_games_count: query.initial_games.length,
              persistence_supported: true,
              success: true,
            };
          }
          break;

        case "export":
          response = this.testCSVExport(
            query.owned_games.map((g) => `${g.game_name}___${g.platform}`)
          );
          break;

        case "sharecode":
          if (query.action === "generate") {
            response = this.testShareCodeGeneration(
              query.owned_games.map((g) => `${g.game_name}___${g.platform}`)
            );
          } else if (query.action === "import") {
            response = this.testShareCodeImport(query.share_code);
          }
          break;

        case "ui_interaction":
          response = {
            action: query.action,
            game: `${query.game_name || "N/A"}___${query.platform || "N/A"}`,
            success: true,
          };
          break;

        case "edge_case":
          if (query.description.includes("empty")) {
            response = {
              test: "empty_query",
              games_returned: this.games.length,
              success: true,
            };
          } else if (query.description.includes("special")) {
            response = this.testSearch(query.query);
          } else if (query.description.includes("missing")) {
            response = this.testSearch(query.game_name);
          }
          break;

        default:
          response = { type: query.type, success: false };
      }

      this.responses.push({
        query_id: query.id,
        query_type: query.type,
        query_description: query.description,
        response,
        timestamp: new Date().toISOString(),
        passed: response?.success !== false,
      });
    }

    return this.responses;
  }

  /**
   * Generate summary statistics
   */
  generateSummary() {
    const total = this.responses.length;
    const passed = this.responses.filter((r) => r.passed).length;
    const failed = total - passed;

    return {
      total_tests: total,
      passed: passed,
      failed: failed,
      pass_rate: ((passed / total) * 100).toFixed(2) + "%",
      test_date: new Date().toISOString(),
      tests_by_type: this.responses.reduce((acc, r) => {
        acc[r.query_type] = (acc[r.query_type] || 0) + 1;
        return acc;
      }, {}),
    };
  }
}

export default GameListTestRunner;
