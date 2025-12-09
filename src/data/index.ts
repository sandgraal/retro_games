/**
 * Data Module Exports
 */

export { loadGames, loadSampleGames, loadPrices } from "./loader";
export {
  getClient as getSupabaseClient,
  isAvailable as isSupabaseAvailable,
  fetchGames as fetchSupabaseGames,
  resetClient as resetSupabaseClient,
} from "./supabase";
