#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, "..");
const OUTPUT_PATH = path.join(ROOT_DIR, "sitemap.xml");
const DEFAULT_BASE_URL = "https://sandgraal.github.io/retro-games";
const BASE_URL = (process.env.SITE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  ".github",
  ".lighthouseci",
  "supabase",
  "evaluation",
  "test-results",
  "coverage",
  "backups",
  "archive",
  "dist",
  "docs",
  "context",
  "scripts",
  "services",
]);
const ROUTE_METADATA = {
  "/": { changefreq: "daily", priority: "1.0" },
};
const ADDITIONAL_ROUTES = [];

async function collectHtmlFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  /** @type {string[]} */
  const files = [];
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectHtmlFiles(fullPath);
      files.push(...nested);
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(fullPath);
    }
  }
  return files;
}

function routeFromFile(fullPath) {
  const relative = path.relative(ROOT_DIR, fullPath).split(path.sep).join("/");
  if (relative === "index.html") return "/";
  if (relative.endsWith("/index.html")) {
    return `/${relative.slice(0, -"index.html".length)}`;
  }
  return `/${relative}`;
}

async function buildRoutes() {
  const htmlFiles = await collectHtmlFiles(ROOT_DIR);
  const routes = [];
  for (const file of htmlFiles) {
    const stats = await fs.stat(file);
    routes.push({
      path: routeFromFile(file),
      lastmod: stats.mtime.toISOString(),
    });
  }
  ADDITIONAL_ROUTES.forEach((route) => {
    routes.push({
      path: route.path,
      lastmod: new Date().toISOString(),
      changefreq: route.changefreq,
      priority: route.priority,
    });
  });
  return routes;
}

function buildXml(urls) {
  const urlset = urls
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((url) => {
      const meta = ROUTE_METADATA[url.path] || {};
      const changefreq = url.changefreq || meta.changefreq || "weekly";
      const priority = url.priority || meta.priority || "0.6";
      const lastmod = url.lastmod || new Date().toISOString();
      return [
        "  <url>",
        `    <loc>${BASE_URL}${url.path === "/" ? "/" : url.path}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${changefreq}</changefreq>`,
        `    <priority>${priority}</priority>`,
        "  </url>",
      ].join("\n");
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlset}\n</urlset>\n`;
}

async function main() {
  try {
    const routes = await buildRoutes();
    if (!routes.length) {
      throw new Error(
        "No HTML routes found. Add an index.html or configure ADDITIONAL_ROUTES."
      );
    }
    const xml = buildXml(routes);
    await fs.writeFile(OUTPUT_PATH, xml, "utf8");
    console.log(`Sitemap written to ${OUTPUT_PATH}`);
    console.log(`Base URL: ${BASE_URL}`);
  } catch (err) {
    console.error("Failed to generate sitemap:", err.message);
    process.exitCode = 1;
  }
}

main();
