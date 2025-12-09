/**
 * Core Type Definitions v3.0
 * Strict, comprehensive types for the entire application
 */

// === Branded Types for Type Safety ===

declare const GameKeyBrand: unique symbol;
export type GameKey = string & { readonly [GameKeyBrand]: never };

declare const PlatformSlugBrand: unique symbol;
export type PlatformSlug = string & { readonly [PlatformSlugBrand]: never };

// Helper to create game keys (use in keys.v3.ts)
export function createGameKey(value: string): GameKey {
  return value as GameKey;
}

// === Game Types ===

export interface Game {
  readonly id?: string;
  readonly game_name: string;
  readonly platform: string;
  readonly genre: string;
  readonly rating: number | string;
  readonly release_year: number | string;
  readonly cover?: string;
  readonly screenshots?: readonly string[];
  readonly region?: string;
  readonly player_mode?: string;
  readonly player_count?: string;
  readonly notes?: string;
  readonly Details?: string;
  readonly rating_category?: string;
  readonly variant_count?: number;
  readonly available_regions?: readonly string[];
}

export interface GameWithKey extends Game {
  readonly key: GameKey;
}

// === Collection Types ===

export type CollectionStatus = "none" | "owned" | "wishlist" | "backlog" | "trade";

export interface CollectionEntry {
  readonly gameKey: GameKey;
  readonly status: Exclude<CollectionStatus, "none">;
  readonly note: string;
  readonly userRating: number | null;
  readonly addedAt: number;
  readonly updatedAt: number;
}

export interface GameNotes {
  readonly gameKey: GameKey;
  readonly notes: string;
  readonly updatedAt: number;
}

// === Price Types ===

export interface PriceData {
  readonly loose?: number;
  readonly cib?: number;
  readonly new?: number;
  readonly currency: string;
  readonly snapshotDate?: string;
}

export type PriceCondition = "loose" | "cib" | "new";

// === Filter Types (simplified for UI compatibility) ===

export type SortField = "game_name" | "release_year" | "rating" | "platform" | "genre";
export type SortDirection = "asc" | "desc";

export interface FilterState {
  readonly search: string;
  readonly platform: string;
  readonly genre: string;
  readonly status: CollectionStatus | "all";
  readonly sortBy: SortField;
  readonly sortDirection: SortDirection;
}

// === UI Types ===

export type ViewMode = "grid" | "list" | "table";
export type Theme = "dark" | "light" | "system";
export type ModalType = "game" | "settings" | "import" | "export" | "share" | null;

export interface UIState {
  readonly viewMode: ViewMode;
  readonly theme: Theme;
  readonly sidebarOpen: boolean;
  readonly activeModal: ModalType;
  readonly selectedGameKey: GameKey | null;
  readonly isLoading: boolean;
  readonly loadingMessage: string;
  readonly error: string | null;
}

// === Data Source Types ===

export type DataSource = "supabase" | "sample" | "indexeddb" | "worker";

export interface DataLoadResult {
  readonly games: readonly Game[];
  readonly source: DataSource;
  readonly timestamp: number;
  readonly fromCache: boolean;
}

// === Statistics Types ===

export interface CollectionStats {
  readonly total: number;
  readonly owned: number;
  readonly wishlist: number;
  readonly backlog: number;
  readonly trade: number;
}

// === Export/Import Types ===

export interface BackupPayload {
  readonly version: number;
  readonly timestamp: number;
  readonly collection: Record<string, CollectionEntry>;
  readonly preferences: Record<string, unknown>;
  readonly checksum: string;
}

export interface SharePayload {
  readonly version: number;
  readonly owned: readonly GameKey[];
  readonly wishlist: readonly GameKey[];
  readonly backlog: readonly GameKey[];
  readonly trade: readonly GameKey[];
  readonly compressed?: boolean;
}

// === Event Types ===

export interface AppEvent<T = unknown> {
  readonly id: string;
  readonly type: string;
  readonly payload: T;
  readonly timestamp: number;
  readonly source: "user" | "system" | "sync";
}

// === Virtual List Types ===

export interface VirtualListItem {
  readonly index: number;
  readonly offset: number;
  readonly size: number;
  readonly data: GameWithKey;
}

export interface VirtualRange {
  readonly start: number;
  readonly end: number;
  readonly overscan: number;
}

// === API Types ===

export interface APIConfig {
  readonly supabaseUrl?: string;
  readonly supabaseKey?: string;
  readonly pricechartingKey?: string;
}

export interface APIResponse<T> {
  readonly data: T | null;
  readonly error: string | null;
  readonly status: number;
  readonly cached: boolean;
}

// === Utility Types ===

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredKeys<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

// === Type Guards ===

export function isGame(value: unknown): value is Game {
  return (
    typeof value === "object" &&
    value !== null &&
    "game_name" in value &&
    "platform" in value &&
    typeof (value as Game).game_name === "string" &&
    typeof (value as Game).platform === "string"
  );
}

export function isGameWithKey(value: unknown): value is GameWithKey {
  return (
    isGame(value) && "key" in value && typeof (value as GameWithKey).key === "string"
  );
}

export function isCollectionEntry(value: unknown): value is CollectionEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    "gameKey" in value &&
    "status" in value &&
    typeof (value as CollectionEntry).gameKey === "string" &&
    ["owned", "wishlist", "backlog", "trade"].includes((value as CollectionEntry).status)
  );
}

export function isValidCollectionStatus(value: string): value is CollectionStatus {
  return ["none", "owned", "wishlist", "backlog", "trade"].includes(value);
}

// === Constants ===

export const COLLECTION_STATUSES: readonly CollectionStatus[] = [
  "none",
  "owned",
  "wishlist",
  "backlog",
  "trade",
] as const;

export const SORT_FIELDS: readonly SortField[] = [
  "game_name",
  "release_year",
  "rating",
  "platform",
  "genre",
] as const;

export const VIEW_MODES: readonly ViewMode[] = ["grid", "list", "table"] as const;

export const THEMES: readonly Theme[] = ["dark", "light", "system"] as const;

export const STATUS_LABELS: Record<CollectionStatus, string> = {
  none: "Not in collection",
  owned: "Owned",
  wishlist: "Wishlist",
  backlog: "Backlog",
  trade: "For Trade",
} as const;

export const STATUS_ICONS: Record<CollectionStatus, string> = {
  none: "",
  owned: "✓",
  wishlist: "★",
  backlog: "📚",
  trade: "↔",
} as const;

export const STATUS_COLORS: Record<CollectionStatus, string> = {
  none: "transparent",
  owned: "#22c55e",
  wishlist: "#f59e0b",
  backlog: "#3b82f6",
  trade: "#8b5cf6",
} as const;
