/**
 * Guides Data Loader
 * Fetches and parses markdown guides with YAML frontmatter
 */

import { marked } from "marked";

// === Types ===

export interface GuideFrontmatter {
  title: string;
  slug: string;
  category: "console" | "genre";
  platform?: string;
  genre?: string;
  author: string;
  date: string;
  updated: string;
  description: string;
  image?: string;
  tags: string[];
}

export interface GuideMetadata extends GuideFrontmatter {
  path: string;
  type: "reference" | "collecting-guide";
}

export interface Guide extends GuideMetadata {
  content: string;
  htmlContent: string;
}

// === Guide Registry ===
// Static list of available guides (generated at build time or maintained manually)

const GUIDE_PATHS = {
  consoles: {
    atari: ["reference", "collecting-guide"],
    dreamcast: ["reference", "collecting-guide"],
    ds: ["reference", "collecting-guide"],
    gameboy: ["reference", "collecting-guide"],
    gamecube: ["reference", "collecting-guide"],
    gba: ["reference", "collecting-guide"],
    genesis: ["reference", "collecting-guide"],
    mastersystem: ["reference", "collecting-guide"],
    n64: ["reference", "collecting-guide"],
    neogeo: ["reference", "collecting-guide"],
    nes: ["reference", "collecting-guide"],
    ps1: ["reference", "collecting-guide"],
    ps2: ["reference", "collecting-guide"],
    ps3: ["reference", "collecting-guide"],
    psp: ["reference", "collecting-guide"],
    saturn: ["reference", "collecting-guide"],
    snes: ["reference", "collecting-guide"],
    turbografx: ["reference", "collecting-guide"],
    wii: ["reference", "collecting-guide"],
    xbox: ["reference", "collecting-guide"],
    xbox360: ["reference", "collecting-guide"],
  },
  genres: {
    action: ["collecting-guide"],
    fighting: ["collecting-guide"],
    platformer: ["collecting-guide"],
    rpg: ["collecting-guide"],
  },
} as const;

// === Frontmatter Parser ===

function parseFrontmatter(markdown: string): {
  frontmatter: Partial<GuideFrontmatter>;
  content: string;
} {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = markdown.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, content: markdown };
  }

  const [, yamlContent, content] = match;
  const frontmatter: Partial<GuideFrontmatter> = {};

  // Simple YAML parser for our specific format
  yamlContent.split("\n").forEach((line) => {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) return;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Remove quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Handle arrays (tags)
    if (value.startsWith("[") && value.endsWith("]")) {
      const arrayContent = value.slice(1, -1);
      (frontmatter as Record<string, unknown>)[key] = arrayContent
        .split(",")
        .map((item) => item.trim().replace(/^["']|["']$/g, ""));
    } else {
      (frontmatter as Record<string, unknown>)[key] = value;
    }
  });

  return { frontmatter, content };
}

// === Markdown Renderer ===

// Configure marked for our needs
marked.setOptions({
  gfm: true,
  breaks: false,
});

function renderMarkdown(content: string): string {
  return marked.parse(content) as string;
}

// === Guide Index Builder ===

export function buildGuideIndex(): GuideMetadata[] {
  const guides: GuideMetadata[] = [];

  // Console guides
  for (const [console, types] of Object.entries(GUIDE_PATHS.consoles)) {
    for (const type of types) {
      guides.push({
        title: `${formatConsoleName(console)} ${type === "reference" ? "Reference" : "Collecting Guide"}`,
        slug: `${console}-${type}`,
        category: "console",
        platform: formatConsoleName(console),
        author: "Games Hub",
        date: "2025-01-01",
        updated: "2025-01-01",
        description: `${type === "reference" ? "Technical reference" : "Collecting guide"} for ${formatConsoleName(console)}`,
        tags: ["collecting", "games", formatConsoleName(console)],
        path: `docs/guides/consoles/${console}/${type}.md`,
        type: type as "reference" | "collecting-guide",
      });
    }
  }

  // Genre guides
  for (const [genre, types] of Object.entries(GUIDE_PATHS.genres)) {
    for (const type of types) {
      guides.push({
        title: `${formatGenreName(genre)} Collecting Guide`,
        slug: `${genre}-${type}`,
        category: "genre",
        genre: formatGenreName(genre),
        author: "Games Hub",
        date: "2025-01-01",
        updated: "2025-01-01",
        description: `Collecting guide for ${formatGenreName(genre)} games across all platforms`,
        tags: ["collecting", "games", formatGenreName(genre)],
        path: `docs/guides/genres/${genre}/${type}.md`,
        type: type as "reference" | "collecting-guide",
      });
    }
  }

  return guides;
}

function formatConsoleName(slug: string): string {
  const names: Record<string, string> = {
    atari: "Atari 2600/7800",
    dreamcast: "Dreamcast",
    gameboy: "Game Boy",
    gamecube: "GameCube",
    genesis: "Genesis",
    mastersystem: "Master System",
    n64: "Nintendo 64",
    neogeo: "Neo Geo",
    nes: "NES",
    ps1: "PlayStation",
    ps2: "PlayStation 2",
    psp: "PSP",
    saturn: "Saturn",
    snes: "SNES",
    turbografx: "TurboGrafx-16",
    wii: "Wii",
  };
  return names[slug] || slug.toUpperCase();
}

function formatGenreName(slug: string): string {
  const names: Record<string, string> = {
    platformer: "Platformer",
    rpg: "RPG",
  };
  return names[slug] || slug.charAt(0).toUpperCase() + slug.slice(1);
}

// === Guide Loader ===

export async function loadGuide(path: string): Promise<Guide | null> {
  try {
    const response = await fetch(`./${path}`);
    if (!response.ok) {
      console.error(`Failed to load guide: ${path}`);
      return null;
    }

    const markdown = await response.text();
    const { frontmatter, content } = parseFrontmatter(markdown);

    // Determine type from path
    const type = path.includes("reference") ? "reference" : "collecting-guide";

    const guide: Guide = {
      title: frontmatter.title || "Untitled Guide",
      slug: frontmatter.slug || path.replace(/\//g, "-").replace(".md", ""),
      category: frontmatter.category || "console",
      platform: frontmatter.platform,
      genre: frontmatter.genre,
      author: frontmatter.author || "Games Hub",
      date: frontmatter.date || "",
      updated: frontmatter.updated || "",
      description: frontmatter.description || "",
      image: frontmatter.image,
      tags: frontmatter.tags || [],
      path,
      type,
      content,
      htmlContent: renderMarkdown(content),
    };

    return guide;
  } catch (error) {
    console.error(`Error loading guide ${path}:`, error);
    return null;
  }
}

// === Exports ===

export { renderMarkdown };
