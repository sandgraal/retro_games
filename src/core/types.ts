/**
 * Core Type Definitions
 * Single source of truth for all data types in the application
 */

// === Game Data Types ===

/**
 * Game data from Supabase games_consolidated view
 * This matches the production schema exactly
 */
export interface Game {
  id?: number; // bigint in Supabase
  game_name: string;
  platform: string;
  genre: string;
  rating: string | number; // numeric in Supabase
  rating_cat?: string; // "Top 10", "Top 25", etc.
  release_year: number | string;
  player_mode?: string;
  region?: string;
  notes?: string;
  player_count?: string;
  cover?: string;
  // Extended metadata (from game consolidation schema)
  description?: string;
  developer?: string;
  publisher?: string;
  esrb_rating?: string;
  metacritic_score?: number;
  igdb_id?: number;
  updated_at?: string;
  // Variant data
  variant_count?: number;
  available_regions?: string[];
  external_links?: ExternalLinks;
  pricing?: PriceData;
  // Legacy fields (sample data only, not in Supabase)
  Details?: string;
  screenshots?: string[];
  rating_category?: string; // Alias for rating_cat in sample data
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
  lastUpdated?: string;
  source?: PricingSource;
  offers?: PricingOffers;
  // Trend data
  weekChangePct?: number;
  monthChangePct?: number;
  allTimeLow?: number;
  allTimeHigh?: number;
}

export type PriceMap = Map<GameKey, PriceData>;

export type PricingSource = "live" | "snapshot" | "cache" | "none";

export interface PriceLoadResult {
  prices: Record<string, PriceData>;
  source: PricingSource;
  lastUpdated?: string;
  reason?: string;
}

export interface RegionalOffer {
  amountCents: number;
  currency: string;
  label?: string;
  retailer?: string;
  url?: string;
  condition?: "loose" | "cib" | "new" | "digital";
  lastUpdated?: string;
}

export type PricingOffers = Record<string, RegionalOffer[]>;

export interface ExternalLinks {
  store?: string | string[];
  wiki?: string;
  community?: string | string[];
}

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
  priceRange: {
    min?: number; // in cents
    max?: number; // in cents
  };
  minRating: number;
  sortBy: SortOption;
  sortDirection: "asc" | "desc";
  showDealsOnly: boolean; // games with price drops
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
  /**
   * Optional context describing how the data was loaded or why a fallback occurred
   */
  reason?: string;
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

// === Auth & Moderation Types ===

export type AuthRole = "anonymous" | "contributor" | "moderator" | "admin";

export interface SuggestionAuthor {
  role: AuthRole;
  email: string | null;
  sessionId: string;
}

export type SuggestionStatus = "pending" | "approved" | "rejected";

export interface SuggestionRecord {
  id: string;
  type: "update" | "new";
  targetId: string | null;
  delta: Record<string, unknown>;
  status: SuggestionStatus;
  author: SuggestionAuthor;
  submittedAt: string;
  notes?: string | null;
  moderationNotes?: string | null;
  decidedAt?: string;
  canonical?: Record<string, unknown> | null;
}

export interface AuditLogEntry {
  suggestionId: string;
  decision: SuggestionStatus;
  notes: string | null;
  moderator: SuggestionAuthor;
  timestamp: string;
}
