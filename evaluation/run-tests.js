#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const GameListTestRunner = require("./test-runner");

/**
 * Main execution script for evaluation
 */

async function main() {
  try {
    console.log("🎮 Retro Game List - Evaluation Test Runner");
    console.log("==========================================\n");

    // Paths
    const rootDir = path.join(__dirname, "..");
    const gamesPath = path.join(rootDir, "games.csv");
    const queriesPath = path.join(__dirname, "queries.json");
    const responsesPath = path.join(__dirname, "responses.json");
    const summaryPath = path.join(__dirname, "summary.json");

    // Load queries
    console.log("📋 Loading test queries...");
    const queries = JSON.parse(fs.readFileSync(queriesPath, "utf-8"));
    console.log(`✅ Loaded ${queries.length} test queries\n`);

    // Initialize test runner
    console.log("🚀 Initializing test runner...");
    const runner = new GameListTestRunner(gamesPath);
    console.log(`✅ Loaded ${runner.games.length} games from database\n`);

    // Run tests
    console.log("⏱️  Running all tests...");
    const responses = await runner.runAllTests(queries);
    console.log(`✅ Completed ${responses.length} tests\n`);

    // Generate summary
    const summary = runner.generateSummary();
    console.log("📊 Test Results Summary:");
    console.log(`   Total Tests:  ${summary.total_tests}`);
    console.log(`   Passed:       ${summary.passed}`);
    console.log(`   Failed:       ${summary.failed}`);
    console.log(`   Pass Rate:    ${summary.pass_rate}\n`);

    console.log("Test Breakdown by Type:");
    Object.entries(summary.tests_by_type).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });
    console.log();

    // Save responses
    console.log("💾 Saving responses...");
    fs.writeFileSync(responsesPath, JSON.stringify(responses, null, 2));
    console.log(`✅ Responses saved to ${responsesPath}\n`);

    // Save summary
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`✅ Summary saved to ${summaryPath}\n`);

    console.log("✨ Evaluation test run completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during test execution:");
    console.error(error);
    process.exit(1);
  }
}

main();
