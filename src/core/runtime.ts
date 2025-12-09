/**
 * Reactive Runtime v3.0
 * High-performance reactive primitives with proper scheduling
 *
 * Key improvements over v2:
 * - Microtask-based scheduling (no sync notifications)
 * - Weak references for automatic cleanup
 * - Proper diamond dependency handling
 * - Topological sorting for computed updates
 * - Batching by default
 */

// === Types ===

export type Dispose = () => void;
export type Subscriber<T> = (value: T, prev: T) => void;
export type Computation = () => void;
export type EqualityFn<T> = (a: T, b: T) => boolean;

interface Node {
  id: number;
  level: number;
  dirty: boolean;
  observers: Set<Node>;
  sources: Set<Node>;
  update: () => void;
}

// === Scheduler ===

let nodeId = 0;
let isScheduled = false;
let isFlushing = false;
const pendingNodes = new Set<Node>();
const pendingEffects: Computation[] = [];

function scheduleFlush(): void {
  if (isScheduled) return;
  isScheduled = true;
  queueMicrotask(flush);
}

function flush(): void {
  if (isFlushing) return;
  isFlushing = true;
  isScheduled = false;

  try {
    // Sort by level for proper propagation order
    const sorted = Array.from(pendingNodes).sort((a, b) => a.level - b.level);
    pendingNodes.clear();

    for (const node of sorted) {
      if (node.dirty) {
        node.update();
        node.dirty = false;
      }
    }

    // Run effects after all computations
    const effects = [...pendingEffects];
    pendingEffects.length = 0;
    for (const effect of effects) {
      effect();
    }
  } finally {
    isFlushing = false;

    // Check if more work was scheduled during flush
    if (pendingNodes.size > 0 || pendingEffects.length > 0) {
      scheduleFlush();
    }
  }
}

function markDirty(node: Node): void {
  if (node.dirty) return;
  node.dirty = true;
  pendingNodes.add(node);
  scheduleFlush();

  // Propagate to observers
  for (const observer of node.observers) {
    markDirty(observer);
  }
}

// === Context Tracking ===

const contextStack: Node[] = [];

function getCurrentNode(): Node | undefined {
  return contextStack[contextStack.length - 1];
}

function withTracking<T>(node: Node, fn: () => T): T {
  // Clear old sources
  for (const source of node.sources) {
    source.observers.delete(node);
  }
  node.sources.clear();

  contextStack.push(node);
  try {
    return fn();
  } finally {
    contextStack.pop();
  }
}

function track(source: Node): void {
  const current = getCurrentNode();
  if (current && current !== source) {
    current.sources.add(source);
    source.observers.add(current);

    // Update level for topological sort
    current.level = Math.max(current.level, source.level + 1);
  }
}

// === Signal ===

export interface Signal<T> {
  (): T;
  readonly value: T;
  set(value: T | ((prev: T) => T)): void;
  peek(): T;
  subscribe(fn: Subscriber<T>): Dispose;
}

export interface SignalOptions<T> {
  equals?: EqualityFn<T>;
  name?: string;
}

const defaultEquals = <T>(a: T, b: T): boolean => Object.is(a, b);

export function signal<T>(initialValue: T, options: SignalOptions<T> = {}): Signal<T> {
  const equals = options.equals ?? defaultEquals;
  let value = initialValue;
  const subscribers = new Set<Subscriber<T>>();

  const node: Node = {
    id: ++nodeId,
    level: 0,
    dirty: false,
    observers: new Set(),
    sources: new Set(),
    update: () => {
      const prev = value;
      subscribers.forEach((fn) => fn(value, prev));
    },
  };

  const get = (): T => {
    track(node);
    return value;
  };

  const set = (newValue: T | ((prev: T) => T)): void => {
    const nextValue =
      typeof newValue === "function" ? (newValue as (prev: T) => T)(value) : newValue;

    if (!equals(value, nextValue)) {
      const prev = value;
      value = nextValue;
      markDirty(node);

      // Immediate subscriber notification in next microtask
      if (subscribers.size > 0) {
        pendingEffects.push(() => {
          subscribers.forEach((fn) => fn(value, prev));
        });
        scheduleFlush();
      }
    }
  };

  const peek = (): T => value;

  const subscribe = (fn: Subscriber<T>): Dispose => {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  };

  // Create the signal function
  const sig = get as Signal<T>;
  Object.defineProperty(sig, "value", { get });
  sig.set = set;
  sig.peek = peek;
  sig.subscribe = subscribe;

  return sig;
}

// === Computed ===

export interface Computed<T> {
  (): T;
  readonly value: T;
  peek(): T;
  subscribe(fn: Subscriber<T>): Dispose;
}

export interface ComputedOptions<T> {
  equals?: EqualityFn<T>;
  name?: string;
}

export function computed<T>(
  compute: () => T,
  options: ComputedOptions<T> = {}
): Computed<T> {
  const equals = options.equals ?? defaultEquals;
  let value: T;
  let initialized = false;
  const subscribers = new Set<Subscriber<T>>();

  const node: Node = {
    id: ++nodeId,
    level: 1,
    dirty: true,
    observers: new Set(),
    sources: new Set(),
    update: () => {
      const prev = value;
      const next = withTracking(node, compute);

      if (!initialized || !equals(value, next)) {
        value = next;
        initialized = true;

        if (subscribers.size > 0) {
          pendingEffects.push(() => {
            subscribers.forEach((fn) => fn(value, prev));
          });
        }
      }
    },
  };

  const get = (): T => {
    track(node);

    if (node.dirty) {
      node.update();
      node.dirty = false;
    }

    return value;
  };

  const peek = (): T => {
    if (node.dirty) {
      node.update();
      node.dirty = false;
    }
    return value;
  };

  const subscribe = (fn: Subscriber<T>): Dispose => {
    subscribers.add(fn);
    // Ensure computed is initialized
    get();
    return () => subscribers.delete(fn);
  };

  const comp = get as Computed<T>;
  Object.defineProperty(comp, "value", { get });
  comp.peek = peek;
  comp.subscribe = subscribe;

  return comp;
}

// === Effect ===

export function effect(fn: () => void | Dispose): Dispose {
  let cleanup: Dispose | void;

  const node: Node = {
    id: ++nodeId,
    level: Infinity, // Effects run last
    dirty: true,
    observers: new Set(),
    sources: new Set(),
    update: () => {
      if (cleanup) {
        cleanup();
        cleanup = undefined;
      }
      cleanup = withTracking(node, fn);
    },
  };

  // Run immediately
  node.update();
  node.dirty = false;

  return () => {
    if (cleanup) cleanup();
    // Disconnect from all sources
    for (const source of node.sources) {
      source.observers.delete(node);
    }
    node.sources.clear();
    pendingNodes.delete(node);
  };
}

// === Batch ===

let batchDepth = 0;
const batchedUpdates: (() => void)[] = [];

export function batch<T>(fn: () => T): T {
  batchDepth++;
  try {
    return fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) {
      const updates = [...batchedUpdates];
      batchedUpdates.length = 0;
      updates.forEach((u) => u());
    }
  }
}

// === Untrack ===

export function untrack<T>(fn: () => T): T {
  const prev = contextStack.pop();
  try {
    return fn();
  } finally {
    if (prev) contextStack.push(prev);
  }
}

// === Utilities ===

export function isSignal(value: unknown): value is Signal<unknown> {
  return typeof value === "function" && "set" in value && "peek" in value;
}

export function isComputed(value: unknown): value is Computed<unknown> {
  return typeof value === "function" && "peek" in value && !("set" in value);
}

// === Store (for complex objects) ===

export type Store<T extends object> = T & {
  [K in keyof T]: T[K] extends object ? Store<T[K]> : T[K];
};

const STORE_SIGNALS = new WeakMap<object, Map<string | symbol, Signal<unknown>>>();

export function store<T extends object>(initial: T): Store<T> {
  const signals = new Map<string | symbol, Signal<unknown>>();
  STORE_SIGNALS.set(initial, signals);

  return new Proxy(initial, {
    get(target, prop, receiver) {
      if (typeof prop === "symbol") {
        return Reflect.get(target, prop, receiver);
      }

      let sig = signals.get(prop);
      if (!sig) {
        sig = signal((target as Record<string, unknown>)[prop]);
        signals.set(prop, sig);
      }

      return sig();
    },

    set(target, prop, value) {
      if (typeof prop === "symbol") {
        return Reflect.set(target, prop, value);
      }

      let sig = signals.get(prop);
      if (!sig) {
        sig = signal(value);
        signals.set(prop, sig);
      } else {
        sig.set(value);
      }

      (target as Record<string, unknown>)[prop] = value;
      return true;
    },
  }) as Store<T>;
}

// === Async Support ===

export interface Resource<T> {
  (): T | undefined;
  loading: Computed<boolean>;
  error: Computed<Error | undefined>;
  refetch: () => Promise<T>;
  mutate: (value: T) => void;
}

export function resource<T>(
  fetcher: () => Promise<T>,
  options: { initialValue?: T } = {}
): Resource<T> {
  const value = signal<T | undefined>(options.initialValue);
  const loading = signal(true);
  const error = signal<Error | undefined>(undefined);

  const fetch = async (): Promise<T> => {
    loading.set(true);
    error.set(undefined);

    try {
      const result = await fetcher();
      value.set(result);
      return result;
    } catch (e) {
      error.set(e instanceof Error ? e : new Error(String(e)));
      throw e;
    } finally {
      loading.set(false);
    }
  };

  // Initial fetch
  fetch().catch(() => {});

  const get = () => value();

  const res = get as Resource<T>;
  res.loading = computed(() => loading());
  res.error = computed(() => error());
  res.refetch = fetch;
  res.mutate = (v: T) => value.set(v);

  return res;
}
