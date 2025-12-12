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
      "Famicom",
      "Super Famicom",
    ],
  },
  {
    id: "playstation",
    name: "PlayStation",
    icon: "🎮",
    color: "#003791",
    platforms: [
      "PS1",
      "PS2",
      "PS3",
      "PS4",
      "PS5",
      "PSP",
      "PS Vita",
      "PlayStation",
      "PlayStation 2",
      "PlayStation 3",
      "PlayStation 4",
      "PlayStation 5",
    ],
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
    platforms: ["PC", "DOS", "Windows", "Mac", "Linux", "Steam"],
  },
  {
    id: "mobile",
    name: "Mobile",
    icon: "📱",
    color: "#34c759",
    platforms: ["iOS", "Android", "Mobile", "Apple Arcade"],
  },
  {
    id: "vr",
    name: "VR/AR",
    icon: "🥽",
    color: "#9b59b6",
    platforms: [
      "Oculus Quest",
      "Meta Quest",
      "PSVR",
      "PSVR2",
      "Valve Index",
      "HTC Vive",
      "VR",
    ],
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
      "Pinball",
    ],
  },
];

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
