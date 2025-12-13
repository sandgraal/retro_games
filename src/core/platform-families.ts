/**
 * Platform Families
 * Groups 54+ platforms into logical families for easier navigation
 */

export interface PlatformFamily {
  id: string;
  name: string;
  icon: string;
  platforms: string[];
  color: string;
}

/**
 * Platform family definitions
 * Organized by manufacturer/type with associated platforms
 * CANONICAL NAMES - all data should be normalized to these
 */
export const PLATFORM_FAMILIES: PlatformFamily[] = [
  {
    id: "nintendo",
    name: "Nintendo",
    icon: "🍄",
    color: "#e60012",
    platforms: [
      "NES",
      "SNES",
      "N64",
      "GameCube",
      "Wii",
      "Wii U",
      "Switch",
      "Game Boy",
      "Game Boy Color",
      "Game Boy Advance",
      "Nintendo DS",
      "Nintendo 3DS",
      "Virtual Boy",
    ],
  },
  {
    id: "playstation",
    name: "PlayStation",
    icon: "🎮",
    color: "#003791",
    platforms: ["PS1", "PS2", "PS3", "PS4", "PS5", "PSP", "PS Vita", "PSVR", "PSVR2"],
  },
  {
    id: "xbox",
    name: "Xbox",
    icon: "🟢",
    color: "#107c10",
    platforms: ["Xbox", "Xbox 360", "Xbox One", "Xbox Series X/S"],
  },
  {
    id: "sega",
    name: "Sega",
    icon: "💙",
    color: "#0060a8",
    platforms: [
      "Genesis",
      "Mega Drive",
      "Master System",
      "Saturn",
      "Dreamcast",
      "Game Gear",
      "Sega CD",
      "32X",
      "SG-1000",
    ],
  },
  {
    id: "atari",
    name: "Atari",
    icon: "🕹️",
    color: "#e4002b",
    platforms: [
      "Atari 2600",
      "Atari 5200",
      "Atari 7800",
      "Atari Jaguar",
      "Atari Lynx",
      "Atari ST",
    ],
  },
  {
    id: "pc",
    name: "PC",
    icon: "💻",
    color: "#00a4ef",
    platforms: ["PC", "DOS", "Mac", "Linux"],
  },
  {
    id: "mobile",
    name: "Mobile",
    icon: "📱",
    color: "#34c759",
    platforms: ["iOS", "Android"],
  },
  {
    id: "vr",
    name: "VR/AR",
    icon: "🥽",
    color: "#9b59b6",
    platforms: ["Meta Quest", "PSVR", "PSVR2", "Valve Index", "HTC Vive"],
  },
  {
    id: "retro",
    name: "Classic/Other",
    icon: "🎰",
    color: "#f39c12",
    platforms: [
      "Neo Geo",
      "Neo Geo Pocket",
      "TurboGrafx-16",
      "PC Engine",
      "3DO",
      "CD-i",
      "Intellivision",
      "ColecoVision",
      "Vectrex",
      "Commodore 64",
      "Amiga",
      "MSX",
      "ZX Spectrum",
      "Arcade",
    ],
  },
];

/**
 * Platform name aliases → canonical name
 * Used to normalize incoming data to canonical platform names
 */
export const PLATFORM_ALIASES: Record<string, string> = {
  // Nintendo
  "nintendo switch": "Switch",
  famicom: "NES",
  "super famicom": "SNES",
  "nintendo 64": "N64",
  "nintendo gamecube": "GameCube",
  "nintendo wii": "Wii",
  "nintendo wii u": "Wii U",
  gba: "Game Boy Advance",
  gbc: "Game Boy Color",
  gb: "Game Boy",
  ds: "Nintendo DS",
  "3ds": "Nintendo 3DS",
  "new nintendo 3ds": "Nintendo 3DS",

  // PlayStation
  playstation: "PS1",
  "playstation 1": "PS1",
  psx: "PS1",
  "playstation 2": "PS2",
  "playstation 3": "PS3",
  "playstation 4": "PS4",
  "playstation 5": "PS5",
  "playstation portable": "PSP",
  "playstation vita": "PS Vita",
  vita: "PS Vita",
  "playstation vr": "PSVR",
  "playstation vr2": "PSVR2",
  "ps vr": "PSVR",
  "ps vr2": "PSVR2",

  // Xbox
  "xbox series x": "Xbox Series X/S",
  "xbox series s": "Xbox Series X/S",
  "xbox series": "Xbox Series X/S",
  xsx: "Xbox Series X/S",
  xbone: "Xbox One",

  // Sega
  "sega genesis": "Genesis",
  "sega mega drive": "Mega Drive",
  "sega master system": "Master System",
  "sega saturn": "Saturn",
  "sega dreamcast": "Dreamcast",
  "sega game gear": "Game Gear",
  "sega 32x": "32X",

  // PC
  windows: "PC",
  "microsoft windows": "PC",
  steam: "PC",
  macos: "Mac",
  macintosh: "Mac",
  "apple mac": "Mac",

  // VR
  "oculus quest": "Meta Quest",
  "oculus quest 2": "Meta Quest",
  "meta quest 2": "Meta Quest",
  "meta quest 3": "Meta Quest",
  quest: "Meta Quest",
  "quest 2": "Meta Quest",
  "quest 3": "Meta Quest",
  steamvr: "Valve Index",
  vr: "Meta Quest",

  // Retro
  "turbografx 16": "TurboGrafx-16",
  "turbografx-cd": "TurboGrafx-16",
  "pc engine cd": "PC Engine",
  "neo-geo": "Neo Geo",
  neogeo: "Neo Geo",
  "neo geo aes": "Neo Geo",
  "neo geo mvs": "Neo Geo",
  c64: "Commodore 64",
};

/**
 * Normalize a platform name to its canonical form
 */
export function normalizePlatform(platform: string): string {
  if (!platform) return platform;
  const lower = platform.toLowerCase().trim();
  return PLATFORM_ALIASES[lower] ?? platform;
}

/**
 * Map of platform name to family ID for quick lookup
 */
export const PLATFORM_TO_FAMILY: Map<string, string> = new Map(
  PLATFORM_FAMILIES.flatMap((family) =>
    family.platforms.map((platform) => [platform.toLowerCase(), family.id])
  )
);

/**
 * Get the family for a platform
 */
export function getPlatformFamily(platform: string): PlatformFamily | undefined {
  const familyId = PLATFORM_TO_FAMILY.get(platform.toLowerCase());
  return PLATFORM_FAMILIES.find((f) => f.id === familyId);
}

/**
 * Get all platforms in a family
 */
export function getPlatformsInFamily(familyId: string): string[] {
  const family = PLATFORM_FAMILIES.find((f) => f.id === familyId);
  return family?.platforms ?? [];
}

/**
 * Group platforms by family, returning counts
 */
export function groupPlatformsByFamily(
  platforms: string[],
  platformCounts: Map<string, number>
): Array<{
  family: PlatformFamily;
  platforms: Array<{ name: string; count: number }>;
  totalCount: number;
}> {
  const groups = new Map<
    string,
    {
      family: PlatformFamily;
      platforms: Array<{ name: string; count: number }>;
      totalCount: number;
    }
  >();

  // Initialize groups
  for (const family of PLATFORM_FAMILIES) {
    groups.set(family.id, { family, platforms: [], totalCount: 0 });
  }

  // Add "other" group for unmatched platforms
  const otherFamily: PlatformFamily = {
    id: "other",
    name: "Other",
    icon: "🎲",
    color: "#95a5a6",
    platforms: [],
  };
  groups.set("other", { family: otherFamily, platforms: [], totalCount: 0 });

  // Group platforms
  for (const platform of platforms) {
    const familyId = PLATFORM_TO_FAMILY.get(platform.toLowerCase()) ?? "other";
    const group = groups.get(familyId);
    if (group) {
      const count = platformCounts.get(platform) ?? 0;
      group.platforms.push({ name: platform, count });
      group.totalCount += count;
    }
  }

  // Sort platforms within each group by count
  for (const group of groups.values()) {
    group.platforms.sort((a, b) => b.count - a.count);
  }

  // Filter out empty groups and sort by total count
  return Array.from(groups.values())
    .filter((g) => g.platforms.length > 0)
    .sort((a, b) => b.totalCount - a.totalCount);
}

/**
 * Get family color as CSS variable or fallback
 */
export function getFamilyColor(familyId: string): string {
  const family = PLATFORM_FAMILIES.find((f) => f.id === familyId);
  return family?.color ?? "#95a5a6";
}
