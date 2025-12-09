/**
 * Key helpers extracted from the legacy app.js.
 * Keys combine game title and platform to stay stable across modules.
 */

const KEY_SEPARATOR = "___";

/**
 * Build a stable composite key for a game/platform pair.
 * @param {string} gameName
 * @param {string} platform
 * @returns {string}
 */
export function generateGameKey(gameName, platform) {
  const name = (gameName ?? "").toString().trim();
  const system = (platform ?? "").toString().trim();
  if (!name && !system) return "";
  return `${name || "unknown"}${KEY_SEPARATOR}${system || "unknown"}`;
}

/**
 * Split a composite key back into its parts.
 * @param {string} key
 * @returns {{ game: string, platform: string }}
 */
export function parseGameKey(key) {
  if (!key) return { game: "", platform: "" };
  const [game, platform] = key.split(KEY_SEPARATOR);
  return { game: game || "", platform: platform || "" };
}
