/**
 * Core Type Definitions
 * Single source of truth for all data types in the application
 */

// === Game Data Types ===

export interface Game {
  id?: string;
  game_name: string;
  platform: string;
  genre: string;
  rating: string | number;
  release_year: string | number;
  cover?: string;
  screenshots?: string[];
  region?: string;
  player_mode?: string;
  player_count?: string;
  notes?: string;
  Details?: string;
  rating_category?: string;
  variant_count?: number;
  available_regions?: string[];
}

export type GameKey = string; // Format: "gameName___platform"

export interface GameWithKey extends Game {
  key: GameKey;
}

// === Collection Status Types ===

export type CollectionStatus = "none" | "owned" | "wishlist" | "backlog" | "trade";

export interface CollectionEntry {
  gameKey: GameKey;
  status: CollectionStatus;
  addedAt: number;
  notes?: string;
}

export type CollectionMap = Map<GameKey, CollectionEntry>;

// === Price Types ===

export interface PriceData {
  loose?: number;
  cib?: number;
  new?: number;
  currency: string;
  snapshotDate?: string;
}

export type PriceMap = Map<GameKey, PriceData>;

// === Filter Types ===

export interface FilterState {
  platforms: Set<string>;
  genres: Set<string>;
  regions: Set<string>;
  statuses: Set<CollectionStatus>;
  searchQuery: string;
  yearRange: {
    start?: number;
    end?: number;
  };
  minRating: number;
  sortBy: SortOption;
  sortDirection: "asc" | "desc";
}

export type SortOption = "name" | "rating" | "year" | "value" | "platform";

// === UI State Types ===

export type ViewMode = "grid" | "list" | "table";
export type Theme = "dark" | "light" | "system";

export interface UIState {
  viewMode: ViewMode;
  theme: Theme;
  sidebarOpen: boolean;
  modalOpen: boolean;
  currentGame: GameWithKey | null;
  isLoading: boolean;
  error: string | null;
}

// === Data Source Types ===

export type DataSource = "supabase" | "sample" | "cache";

export interface DataLoadResult {
  games: Game[];
  source: DataSource;
  timestamp: number;
}

// === Event Types ===

export interface GameStatusChangeEvent {
  gameKey: GameKey;
  previousStatus: CollectionStatus;
  newStatus: CollectionStatus;
}

export interface GameModalOpenEvent {
  game: GameWithKey;
}

// === Statistics Types ===

export interface CollectionStats {
  totalGames: number;
  ownedCount: number;
  wishlistCount: number;
  backlogCount: number;
  tradeCount: number;
  totalValue: number;
  platformBreakdown: Map<string, number>;
  genreBreakdown: Map<string, number>;
  averageRating: number;
  completionPercentage: number;
}

// === API Types ===

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  tableName?: string;
}

// === Utility Types ===

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type NonNullableFields<T> = {
  [P in keyof T]: NonNullable<T[P]>;
};
