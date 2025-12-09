/**
 * Game Key Utilities v3.0
 * Compound key generation and parsing with validation
 */

import type { Game, GameWithKey, GameKey } from "./types.v3";

const KEY_SEPARATOR = "___";

/**
 * Generate a compound game key from name and platform
 * Returns empty string if inputs are invalid
 */
export function generateGameKey(name: string, platform: string): GameKey {
  const normalizedName = normalizeString(name);
  const normalizedPlatform = normalizeString(platform);

  if (!normalizedName || !normalizedPlatform) {
    return "" as GameKey;
  }

  return `${normalizedName}${KEY_SEPARATOR}${normalizedPlatform}` as GameKey;
}

/**
 * Generate key from game object
 */
export function gameToKey(game: Game): GameKey {
  return generateGameKey(game.game_name, game.platform);
}

/**
 * Parse a game key into its components
 */
export function parseGameKey(key: GameKey): { name: string; platform: string } | null {
  if (!key || !key.includes(KEY_SEPARATOR)) {
    return null;
  }

  const [name, platform] = key.split(KEY_SEPARATOR);

  if (!name || !platform) {
    return null;
  }

  return { name, platform };
}

/**
 * Validate a game key
 */
export function isValidGameKey(key: string): key is GameKey {
  if (!key || typeof key !== "string") {
    return false;
  }

  const parts = key.split(KEY_SEPARATOR);
  return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
}

/**
 * Add key to a game
 */
export function withKey<T extends Game>(game: T): T & { key: GameKey } {
  return {
    ...game,
    key: gameToKey(game),
  };
}

/**
 * Add keys to multiple games
 */
export function withKeys<T extends Game>(
  games: readonly T[]
): Array<T & { key: GameKey }> {
  return games.map(withKey);
}

/**
 * Check if a key matches a game
 */
export function keyMatchesGame(key: GameKey, game: Game): boolean {
  return gameToKey(game) === key;
}

/**
 * Create a lookup map from games by key
 */
export function createGameLookup(
  games: readonly GameWithKey[]
): Map<GameKey, GameWithKey> {
  return new Map(games.map((g) => [g.key, g]));
}

/**
 * Create a lookup map from games by key (returns index)
 */
export function createGameIndexLookup(
  games: readonly GameWithKey[]
): Map<GameKey, number> {
  return new Map(games.map((g, i) => [g.key, i]));
}

/**
 * Find game by key in array
 */
export function findGameByKey(
  games: readonly GameWithKey[],
  key: GameKey
): GameWithKey | undefined {
  return games.find((g) => g.key === key);
}

/**
 * Filter games by keys
 */
export function filterGamesByKeys(
  games: readonly GameWithKey[],
  keys: ReadonlySet<GameKey>
): GameWithKey[] {
  return games.filter((g) => keys.has(g.key));
}

/**
 * Normalize string for key generation
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^\w\s-]/g, "") // Remove special chars except hyphen
    .replace(/\s+/g, " "); // Normalize whitespace
}

/**
 * Create URL-safe slug from game key
 */
export function keyToSlug(key: GameKey): string {
  return encodeURIComponent(key);
}

/**
 * Parse URL slug back to game key
 */
export function slugToKey(slug: string): GameKey {
  return decodeURIComponent(slug) as GameKey;
}

/**
 * Generate platform-specific ID for deduplication
 */
export function generatePlatformKey(platform: string): string {
  return platform
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/**
 * Batch process: Remove duplicates by key
 */
export function deduplicateByKey(games: readonly GameWithKey[]): GameWithKey[] {
  const seen = new Set<GameKey>();
  const result: GameWithKey[] = [];

  for (const game of games) {
    if (!seen.has(game.key)) {
      seen.add(game.key);
      result.push(game);
    }
  }

  return result;
}

/**
 * Merge two game arrays, preferring items from the second array on conflict
 */
export function mergeGames(
  base: readonly GameWithKey[],
  override: readonly GameWithKey[]
): GameWithKey[] {
  const lookup = createGameLookup(base);

  for (const game of override) {
    lookup.set(game.key, game);
  }

  return Array.from(lookup.values());
}

/**
 * Diff two game arrays
 */
export function diffGames(
  oldGames: readonly GameWithKey[],
  newGames: readonly GameWithKey[]
): {
  added: GameWithKey[];
  removed: GameWithKey[];
  unchanged: GameWithKey[];
} {
  const oldKeys = new Set(oldGames.map((g) => g.key));
  const newKeys = new Set(newGames.map((g) => g.key));

  return {
    added: newGames.filter((g) => !oldKeys.has(g.key)),
    removed: oldGames.filter((g) => !newKeys.has(g.key)),
    unchanged: newGames.filter((g) => oldKeys.has(g.key)),
  };
}
