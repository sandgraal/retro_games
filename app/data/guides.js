/**
 * Guide URL mappings for collector guides.
 * Maps platform names to GitHub guide URLs.
 * @module data/guides
 */

const GITHUB_BASE =
  "https://github.com/sandgraal/retro-games/blob/main/docs/guides/consoles";

/**
 * Platform to guide directory mapping.
 * Keys are normalized platform names (lowercase).
 */
const PLATFORM_GUIDE_MAP = {
  // Nintendo
  nes: "nes",
  famicom: "nes",
  "nintendo entertainment system": "nes",
  snes: "snes",
  "super nintendo": "snes",
  "super famicom": "snes",
  n64: "n64",
  "nintendo 64": "n64",
  gamecube: "gamecube",
  gcn: "gamecube",
  wii: "wii",
  gb: "gameboy",
  gbc: "gameboy",
  gba: "gameboy",
  "game boy": "gameboy",
  "game boy color": "gameboy",
  "game boy advance": "gameboy",

  // Sega
  genesis: "genesis",
  "mega drive": "genesis",
  "sega genesis": "genesis",
  saturn: "saturn",
  "sega saturn": "saturn",
  dreamcast: "dreamcast",
  "sega dreamcast": "dreamcast",
  "master system": "mastersystem",
  "sega master system": "mastersystem",
  sms: "mastersystem",

  // Sony
  ps1: "ps1",
  psx: "ps1",
  playstation: "ps1",
  "playstation 1": "ps1",
  ps2: "ps2",
  "playstation 2": "ps2",
  psp: "psp",
  "playstation portable": "psp",

  // Other
  "turbografx-16": "turbografx",
  "pc engine": "turbografx",
  tg16: "turbografx",
  "neo geo": "neogeo",
  "neo-geo": "neogeo",
  neogeo: "neogeo",
  aes: "neogeo",
  mvs: "neogeo",
  "atari 2600": "atari",
  "atari 7800": "atari",
  atari: "atari",
  2600: "atari",
  7800: "atari",
};

/**
 * Normalize platform name for lookup.
 * @param {string} platform - Platform name
 * @returns {string} Normalized platform name
 */
function normalizePlatform(platform) {
  if (!platform || typeof platform !== "string") return "";
  return platform.toLowerCase().trim();
}

/**
 * Get the guide directory for a platform.
 * @param {string} platform - Platform name
 * @returns {string|null} Guide directory or null if not found
 */
export function getGuideDirectory(platform) {
  const normalized = normalizePlatform(platform);
  return PLATFORM_GUIDE_MAP[normalized] || null;
}

/**
 * Get the reference guide URL for a platform.
 * @param {string} platform - Platform name
 * @returns {string|null} GitHub URL or null if no guide exists
 */
export function getReferenceGuideUrl(platform) {
  const dir = getGuideDirectory(platform);
  if (!dir) return null;
  return `${GITHUB_BASE}/${dir}/reference.md`;
}

/**
 * Get the collecting guide URL for a platform.
 * @param {string} platform - Platform name
 * @returns {string|null} GitHub URL or null if no guide exists
 */
export function getCollectingGuideUrl(platform) {
  const dir = getGuideDirectory(platform);
  if (!dir) return null;
  return `${GITHUB_BASE}/${dir}/collecting-guide.md`;
}

/**
 * Check if a platform has collector guides available.
 * @param {string} platform - Platform name
 * @returns {boolean} True if guides exist
 */
export function hasGuides(platform) {
  return getGuideDirectory(platform) !== null;
}

/**
 * Get display name for guide links.
 * @param {string} platform - Platform name
 * @returns {string} Display name for the guide
 */
export function getGuideDisplayName(platform) {
  const dir = getGuideDirectory(platform);
  if (!dir) return "";

  const displayNames = {
    nes: "NES",
    snes: "SNES",
    n64: "N64",
    gamecube: "GameCube",
    wii: "Wii",
    gameboy: "Game Boy",
    genesis: "Genesis",
    saturn: "Saturn",
    dreamcast: "Dreamcast",
    mastersystem: "Master System",
    ps1: "PS1",
    ps2: "PS2",
    psp: "PSP",
    turbografx: "TurboGrafx-16",
    neogeo: "Neo Geo",
    atari: "Atari",
  };

  return displayNames[dir] || platform;
}
