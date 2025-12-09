/**
 * Core Module Exports
 */

// Reactive primitives
export {
  createSignal,
  computed,
  effect,
  batch,
  type Subscriber,
  type Unsubscribe,
  type Getter,
  type Setter,
} from "./signals";

// Type definitions
export type {
  Game,
  GameKey,
  GameWithKey,
  CollectionStatus,
  CollectionEntry,
  CollectionMap,
  PriceData,
  PriceMap,
  FilterState,
  SortOption,
  ViewMode,
  Theme,
  UIState,
  DataSource,
  DataLoadResult,
  GameStatusChangeEvent,
  GameModalOpenEvent,
  CollectionStats,
  SupabaseConfig,
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
