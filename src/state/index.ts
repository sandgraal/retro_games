/**
 * State Module Exports
 */

export {
  // Computed state
  filteredGames,
  availablePlatforms,
  availableGenres,
  collectionStats,

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
  setSearchQuery,
  setSort,
  setTheme,
  setViewMode,
  toggleSidebar,
  openGameModal,
  closeGameModal,
  loadPersistedState,
} from "./store";
