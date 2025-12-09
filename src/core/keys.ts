/**
 * Game Key Utilities
 * Generates compound keys for uniquely identifying games across platforms
 */

import type { Game, GameKey, GameWithKey } from "./types";

const KEY_SEPARATOR = "___";

/**
 * Generate a unique key for a game based on name and platform
 */
export function generateGameKey(name: string, platform: string): GameKey {
  if (!name || !platform) return "";
  const normalizedName = name.trim().toLowerCase();
  const normalizedPlatform = platform.trim().toLowerCase();
  return `${normalizedName}${KEY_SEPARATOR}${normalizedPlatform}`;
}

/**
 * Parse a game key back into name and platform
 */
export function parseGameKey(key: GameKey): { name: string; platform: string } | null {
  if (!key || typeof key !== "string") return null;
  const parts = key.split(KEY_SEPARATOR);
  if (parts.length !== 2) return null;
  return {
    name: parts[0],
    platform: parts[1],
  };
}

/**
 * Enrich a game object with its computed key
 */
export function withGameKey(game: Game): GameWithKey {
  return {
    ...game,
    key: generateGameKey(game.game_name, game.platform),
  };
}

/**
 * Enrich multiple games with their computed keys
 */
export function withGameKeys(games: Game[]): GameWithKey[] {
  return games.map(withGameKey);
}

/**
 * Check if a key matches a game
 */
export function keyMatchesGame(key: GameKey, game: Game): boolean {
  return generateGameKey(game.game_name, game.platform) === key;
}

/**
 * Create a lookup map from games array
 */
export function createGameLookup(games: GameWithKey[]): Map<GameKey, GameWithKey> {
  return new Map(games.map((g) => [g.key, g]));
}
