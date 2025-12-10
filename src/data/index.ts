/**
 * Data Module Exports
 */

export { loadGames, loadSampleGames, loadPrices } from "./loader";
export {
  getClient as getSupabaseClient,
  isAvailable as isSupabaseAvailable,
  fetchGames as fetchSupabaseGames,
  waitForSupabaseReady,
  resetClient as resetSupabaseClient,
} from "./supabase";
export {
  buildGuideIndex,
  loadGuide,
  renderMarkdown,
  type GuideMetadata,
  type GuideFrontmatter,
  type Guide,
} from "./guides";
