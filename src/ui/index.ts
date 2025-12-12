/**
 * UI Module Exports
 */

export { mount, escapeHtml, createElement, el, debounce, throttle } from "./components";
export {
  createGameCard,
  createSkeletonCard,
  renderGameCards,
  renderSkeletonCards,
} from "./game-card";
export { mountGameGrid } from "./game-grid";
export { mountDashboard } from "./dashboard";
export { mountFilters } from "./filters";
export { mountModal } from "./modal";
export { mountSettingsModal, openSettings, closeSettings } from "./settings-modal";
export { mountGuides, showGuidesView, hideGuidesView, navigateToGuide } from "./guides";
export { mountModerationPanel } from "./moderation";
export { openImportModal, closeImportModal, injectImportStyles } from "./import-modal";
export { initSmartSearch, clearRecentSearches } from "./smart-search";
export { initCuratedSections, generateCuratedSections } from "./curated-sections";
export {
  initInfiniteScroll,
  loadMoreGames,
  resetPagination,
  getPaginatedGames,
  getPaginationInfo,
  createLoadMoreButton,
  currentPage,
  isLoadingMore,
  hasMoreGames,
} from "./infinite-scroll";
export {
  initPresets,
  renderPresetSelector,
  applyPreset,
  createPreset,
  deletePreset,
  getAllPresets,
  userPresets,
  activePreset,
  type FilterPreset,
} from "./filter-presets";
export {
  initRecentlyViewed,
  renderRecentlyViewed,
  trackGameView,
  addToRecentlyViewed,
  clearRecentlyViewed,
  getRecentlyViewedGames,
  recentlyViewedSignal,
} from "./recently-viewed";
export {
  initUrlState,
  readFiltersFromUrl,
  writeFiltersToUrl,
  getShareableFilterUrl,
  copyFilterUrl,
  hasUrlFilters,
  clearUrlFilters,
  getFilterDescription,
} from "./url-state";
