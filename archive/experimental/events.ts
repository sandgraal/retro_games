/**
 * Event Sourcing Core
 * All state changes are immutable events
 * Enables time-travel debugging, undo/redo, and reliable persistence
 */

import { signal, computed, effect, type Computed } from "./runtime";

// === Event Types ===

export interface DomainEvent<T = unknown> {
  id: string;
  type: string;
  payload: T;
  timestamp: number;
  version: number;
}

export type EventHandler<S, E> = (state: S, event: E) => S;

// === Event Store ===

interface EventStoreOptions<S> {
  initialState: S;
  persist?: boolean;
  storageKey?: string;
  maxEvents?: number;
}

export interface EventStore<S, E extends DomainEvent> {
  state: Computed<S>;
  events: Computed<E[]>;
  dispatch: (event: Omit<E, "id" | "timestamp" | "version">) => E;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: Computed<boolean>;
  canRedo: Computed<boolean>;
  snapshot: () => { state: S; events: E[] };
  restore: (snapshot: { state: S; events: E[] }) => void;
  subscribe: (handler: (event: E, state: S) => void) => () => void;
  clear: () => void;
}

export function createEventStore<S, E extends DomainEvent>(
  reducer: EventHandler<S, E>,
  options: EventStoreOptions<S>
): EventStore<S, E> {
  const {
    initialState,
    persist = false,
    storageKey = "eventstore",
    maxEvents = 1000,
  } = options;

  const eventsSignal = signal<E[]>([]);
  const undoneSignal = signal<E[]>([]);
  const subscribers = new Set<(event: E, state: S) => void>();
  let version = 0;

  // Computed state from events
  const state = computed<S>(() => {
    const events = eventsSignal();
    return events.reduce((s, e) => reducer(s, e), initialState);
  });

  const canUndo = computed(() => eventsSignal().length > 0);
  const canRedo = computed(() => undoneSignal().length > 0);
  const events = computed(() => eventsSignal());

  // Load persisted state
  if (persist && typeof localStorage !== "undefined") {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const { events: storedEvents, version: storedVersion } = JSON.parse(stored);
        eventsSignal.set(storedEvents);
        version = storedVersion;
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Persist on changes
  if (persist) {
    effect(() => {
      const currentEvents = eventsSignal();
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            events: currentEvents.slice(-maxEvents),
            version,
          })
        );
      } catch {
        // Storage full or unavailable
      }
    });
  }

  const dispatch = (partialEvent: Omit<E, "id" | "timestamp" | "version">): E => {
    const event: E = {
      ...partialEvent,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      version: ++version,
    } as E;

    eventsSignal.set((prev) => {
      const next = [...prev, event];
      // Trim if over max
      return next.length > maxEvents ? next.slice(-maxEvents) : next;
    });

    // Clear redo stack on new event
    undoneSignal.set([]);

    // Notify subscribers
    const newState = state();
    subscribers.forEach((fn) => fn(event, newState));

    return event;
  };

  const undo = (): boolean => {
    const currentEvents = eventsSignal();
    if (currentEvents.length === 0) return false;

    const lastEvent = currentEvents[currentEvents.length - 1];
    eventsSignal.set((prev) => prev.slice(0, -1));
    undoneSignal.set((prev) => [...prev, lastEvent]);

    return true;
  };

  const redo = (): boolean => {
    const undone = undoneSignal();
    if (undone.length === 0) return false;

    const eventToRedo = undone[undone.length - 1];
    undoneSignal.set((prev) => prev.slice(0, -1));
    eventsSignal.set((prev) => [...prev, eventToRedo]);

    return true;
  };

  const snapshot = () => ({
    state: state(),
    events: [...eventsSignal()],
  });

  const restore = (snap: { state: S; events: E[] }) => {
    eventsSignal.set(snap.events);
    undoneSignal.set([]);
    version = snap.events.length > 0 ? Math.max(...snap.events.map((e) => e.version)) : 0;
  };

  const subscribe = (handler: (event: E, state: S) => void): (() => void) => {
    subscribers.add(handler);
    return () => subscribers.delete(handler);
  };

  const clear = () => {
    eventsSignal.set([]);
    undoneSignal.set([]);
    version = 0;
    if (persist && typeof localStorage !== "undefined") {
      localStorage.removeItem(storageKey);
    }
  };

  return {
    state,
    events,
    dispatch,
    undo,
    redo,
    canUndo,
    canRedo,
    snapshot,
    restore,
    subscribe,
    clear,
  };
}

// === Collection Events ===

export type CollectionEventType =
  | "GAME_ADDED"
  | "GAME_REMOVED"
  | "STATUS_CHANGED"
  | "NOTE_UPDATED"
  | "RATING_CHANGED"
  | "BULK_IMPORT"
  | "COLLECTION_CLEARED";

export interface GameAddedPayload {
  gameKey: string;
  status: string;
}

export interface StatusChangedPayload {
  gameKey: string;
  previousStatus: string;
  newStatus: string;
}

export interface NoteUpdatedPayload {
  gameKey: string;
  previousNote: string;
  newNote: string;
}

export interface RatingChangedPayload {
  gameKey: string;
  previousRating: number | null;
  newRating: number;
}

export interface BulkImportPayload {
  games: Array<{ gameKey: string; status: string; note?: string }>;
  source: string;
}

export type CollectionEvent = DomainEvent<
  | GameAddedPayload
  | StatusChangedPayload
  | NoteUpdatedPayload
  | RatingChangedPayload
  | BulkImportPayload
  | { gameKey: string }
  | Record<string, never>
>;

// === Collection State ===

export interface CollectionEntry {
  gameKey: string;
  status: "owned" | "wishlist" | "backlog" | "trade";
  note: string;
  userRating: number | null;
  addedAt: number;
  updatedAt: number;
}

export interface CollectionState {
  entries: Map<string, CollectionEntry>;
  stats: {
    owned: number;
    wishlist: number;
    backlog: number;
    trade: number;
    total: number;
  };
}

// === Collection Reducer ===

export function collectionReducer(
  state: CollectionState,
  event: CollectionEvent
): CollectionState {
  const entries = new Map(state.entries);

  switch (event.type) {
    case "GAME_ADDED": {
      const payload = event.payload as GameAddedPayload;
      entries.set(payload.gameKey, {
        gameKey: payload.gameKey,
        status: payload.status as CollectionEntry["status"],
        note: "",
        userRating: null,
        addedAt: event.timestamp,
        updatedAt: event.timestamp,
      });
      break;
    }

    case "GAME_REMOVED": {
      const payload = event.payload as { gameKey: string };
      entries.delete(payload.gameKey);
      break;
    }

    case "STATUS_CHANGED": {
      const payload = event.payload as StatusChangedPayload;
      const existing = entries.get(payload.gameKey);
      if (existing) {
        entries.set(payload.gameKey, {
          ...existing,
          status: payload.newStatus as CollectionEntry["status"],
          updatedAt: event.timestamp,
        });
      } else if (payload.newStatus !== "none") {
        entries.set(payload.gameKey, {
          gameKey: payload.gameKey,
          status: payload.newStatus as CollectionEntry["status"],
          note: "",
          userRating: null,
          addedAt: event.timestamp,
          updatedAt: event.timestamp,
        });
      }
      break;
    }

    case "NOTE_UPDATED": {
      const payload = event.payload as NoteUpdatedPayload;
      const existing = entries.get(payload.gameKey);
      if (existing) {
        entries.set(payload.gameKey, {
          ...existing,
          note: payload.newNote,
          updatedAt: event.timestamp,
        });
      }
      break;
    }

    case "RATING_CHANGED": {
      const payload = event.payload as RatingChangedPayload;
      const existing = entries.get(payload.gameKey);
      if (existing) {
        entries.set(payload.gameKey, {
          ...existing,
          userRating: payload.newRating,
          updatedAt: event.timestamp,
        });
      }
      break;
    }

    case "BULK_IMPORT": {
      const payload = event.payload as BulkImportPayload;
      for (const game of payload.games) {
        const existing = entries.get(game.gameKey);
        entries.set(game.gameKey, {
          gameKey: game.gameKey,
          status: game.status as CollectionEntry["status"],
          note: game.note ?? existing?.note ?? "",
          userRating: existing?.userRating ?? null,
          addedAt: existing?.addedAt ?? event.timestamp,
          updatedAt: event.timestamp,
        });
      }
      break;
    }

    case "COLLECTION_CLEARED": {
      entries.clear();
      break;
    }
  }

  // Recompute stats
  const stats = { owned: 0, wishlist: 0, backlog: 0, trade: 0, total: 0 };
  for (const entry of entries.values()) {
    stats[entry.status]++;
    stats.total++;
  }

  return { entries, stats };
}

// === Filter Events ===

export type FilterEventType =
  | "FILTER_UPDATED"
  | "FILTERS_RESET"
  | "SORT_CHANGED"
  | "SEARCH_CHANGED";

export interface FilterState {
  platforms: Set<string>;
  genres: Set<string>;
  regions: Set<string>;
  statuses: Set<string>;
  searchQuery: string;
  yearRange: { start?: number; end?: number };
  ratingRange: { min: number; max: number };
  sortBy: "name" | "year" | "rating" | "platform" | "added";
  sortDirection: "asc" | "desc";
}

export const DEFAULT_FILTER_STATE: FilterState = {
  platforms: new Set(),
  genres: new Set(),
  regions: new Set(),
  statuses: new Set(),
  searchQuery: "",
  yearRange: {},
  ratingRange: { min: 0, max: 10 },
  sortBy: "name",
  sortDirection: "asc",
};
