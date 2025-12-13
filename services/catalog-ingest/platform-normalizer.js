/**
 * Platform Name Normalizer
 * Maps platform name variations to canonical names
 */

/**
 * Platform name aliases → canonical name
 * Used to normalize incoming data to canonical platform names
 */
export const PLATFORM_ALIASES = {
  // Nintendo
  "nintendo switch": "Switch",
  famicom: "NES",
  "super famicom": "SNES",
  "nintendo 64": "N64",
  "nintendo gamecube": "GameCube",
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
 * @param {string} platform - Platform name to normalize
 * @returns {string} Canonical platform name
 */
export function normalizePlatform(platform) {
  if (!platform) return platform;
  const lower = platform.toLowerCase().trim();
  return PLATFORM_ALIASES[lower] ?? platform;
}
