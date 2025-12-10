/**
 * Tests for CSS build script
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execSync, execFileSync } from "node:child_process";

const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const SCRIPT_PATH = path.join(ROOT_DIR, "scripts/build-css.js");

describe("scripts/build-css.js", () => {
  describe("CSS bundle generation", () => {
    beforeEach(() => {
      // Clean dist directory before each test
      if (fs.existsSync(DIST_DIR)) {
        fs.rmSync(DIST_DIR, { recursive: true, force: true });
      }
    });

    afterEach(() => {
      // Cleanup after tests
      if (fs.existsSync(DIST_DIR)) {
        fs.rmSync(DIST_DIR, { recursive: true, force: true });
      }
    });

    it("creates dist directory if not exists", () => {
      execFileSync("node", [SCRIPT_PATH], { cwd: ROOT_DIR });
      expect(fs.existsSync(DIST_DIR)).toBe(true);
    });

    it("generates style.css debug bundle", () => {
      execSync(`node ${SCRIPT_PATH}`, { cwd: ROOT_DIR });
      const debugPath = path.join(DIST_DIR, "style.css");
      expect(fs.existsSync(debugPath)).toBe(true);
    });

    it("generates style.min.css minified bundle", () => {
      execSync(`node ${SCRIPT_PATH}`, { cwd: ROOT_DIR });
      const minPath = path.join(DIST_DIR, "style.min.css");
      expect(fs.existsSync(minPath)).toBe(true);
    });

    it("minified bundle is smaller than debug bundle", () => {
      execSync(`node ${SCRIPT_PATH}`, { cwd: ROOT_DIR });
      const debugPath = path.join(DIST_DIR, "style.css");
      const minPath = path.join(DIST_DIR, "style.min.css");

      const debugSize = fs.statSync(debugPath).size;
      const minSize = fs.statSync(minPath).size;

      expect(minSize).toBeLessThan(debugSize);
    });

    it("debug bundle includes source file markers", () => {
      execSync(`node ${SCRIPT_PATH}`, { cwd: ROOT_DIR });
      const debugPath = path.join(DIST_DIR, "style.css");
      const content = fs.readFileSync(debugPath, "utf8");

      expect(content).toContain("=== style/tokens.css ===");
      expect(content).toContain("=== style/base.css ===");
    });

    it("minified bundle has no @import statements", () => {
      execSync(`node ${SCRIPT_PATH}`, { cwd: ROOT_DIR });
      const minPath = path.join(DIST_DIR, "style.min.css");
      const content = fs.readFileSync(minPath, "utf8");

      expect(content).not.toContain("@import");
    });

    it("bundle includes CSS custom properties from tokens", () => {
      execSync(`node ${SCRIPT_PATH}`, { cwd: ROOT_DIR });
      const minPath = path.join(DIST_DIR, "style.min.css");
      const content = fs.readFileSync(minPath, "utf8");

      expect(content).toContain("--bg-primary");
      expect(content).toContain("--accent-primary");
      expect(content).toContain("--font-display");
    });

    it("bundle includes component styles", () => {
      execFileSync("node", [SCRIPT_PATH], { cwd: ROOT_DIR });
      const minPath = path.join(DIST_DIR, "style.min.css");
      const content = fs.readFileSync(minPath, "utf8");

      // Check for key component selectors
      expect(content).toContain(".stat-card");
      expect(content).toContain(".game-grid");
      expect(content).toContain(".modal-backdrop");
    });

    it("script exits with code 0 on success", () => {
      let exitCode = 0;
      try {
        execFileSync("node", [SCRIPT_PATH], { cwd: ROOT_DIR });
      } catch {
        exitCode = 1;
      }
      expect(exitCode).toBe(0);
    });

    it("generates production index.html with bundled CSS", () => {
      execFileSync("node", [SCRIPT_PATH], { cwd: ROOT_DIR });
      const indexPath = path.join(DIST_DIR, "index.html");
      expect(fs.existsSync(indexPath)).toBe(true);

      const content = fs.readFileSync(indexPath, "utf8");
      expect(content).toContain('href="style.min.css"');
      expect(content).not.toContain('href="style.css"');
    });

    it("creates symlinks for required assets", () => {
      execFileSync("node", [SCRIPT_PATH], { cwd: ROOT_DIR });

      // Check symlinks or copies exist for key directories
      const dataPath = path.join(DIST_DIR, "data");

      expect(fs.existsSync(dataPath)).toBe(true);
    });
  });
});
