/**
 * Core Module Exports
 */

// Reactive primitives
export {
  createSignal,
  computed,
  effect,
  batch,
  type Signal,
  type ComputedSignal,
  type Subscriber,
  type Unsubscribe,
  type Getter,
  type Setter,
} from "./signals";

// Type definitions
export type {
  // Game types
  Game,
  GameKey,
  GameWithKey,
  // Collection types
  CollectionStatus,
  CollectionEntry,
  CollectionMap,
  // Price types
  PriceData,
  PriceMap,
  PricingSource,
  PriceLoadResult,
  RegionalOffer,
  PricingOffers,
  ExternalLinks,
  // Filter types
  FilterState,
  SortOption,
  // UI types
  ViewMode,
  Theme,
  UIState,
  // Data types
  DataSource,
  DataLoadResult,
  // Event types
  GameStatusChangeEvent,
  GameModalOpenEvent,
  // Stats types
  CollectionStats,
  // Config types
  SupabaseConfig,
  // Auth & moderation types
  AuthRole,
  SuggestionAuthor,
  SuggestionStatus,
  SuggestionRecord,
  AuditLogEntry,
  // Utility types
  DeepPartial,
  NonNullableFields,
} from "./types";

// Key utilities
export {
  generateGameKey,
  parseGameKey,
  withGameKey,
  withGameKeys,
  keyMatchesGame,
  createGameLookup,
} from "./keys";

// Storage helpers
export { safeStorage, isStorageAvailable } from "./storage";
