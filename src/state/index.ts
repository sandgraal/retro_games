/**
 * State Module Exports
 */

export {
  // Computed state
  filteredGames,
  availablePlatforms,
  availableGenres,
  collectionStats,

  // Reactive state signals (for subscriptions)
  gamesSignal,

  // Reactive getters
  games,
  prices,
  priceMeta,
  isLoading,
  error,
  dataSource,
  collection,
  notes,
  filterState,
  theme,
  viewMode,
  sidebarOpen,
  modalGame,

  // Actions
  setGames,
  setPrices,
  setPriceMeta,
  setLoading,
  setError,
  setDataSource,
  setGameStatus,
  getGameStatus,
  setGameNotes,
  getGameNotes,
  updateFilters,
  resetFilters,
  resetCollection,
  togglePlatformFilter,
  toggleGenreFilter,
  toggleRegionFilter,
  toggleStatusFilter,
  setSearchQuery,
  setSort,
  setTheme,
  setViewMode,
  toggleSidebar,
  openGameModal,
  closeGameModal,
  loadPersistedState,
  getRandomGame,
  getRandomGameFromAll,
  applyQuickFilter,
} from "./store";
