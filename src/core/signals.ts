/**
 * Reactive Signal Implementation
 * A minimal, high-performance reactive primitive for state management
 */

export type Subscriber<T> = (value: T) => void;
export type Unsubscribe = () => void;
export type Getter<T> = () => T;
export type Setter<T> = (value: T | ((prev: T) => T)) => void;

export interface Signal<T> {
  get: Getter<T>;
  set: Setter<T>;
  subscribe: (fn: Subscriber<T>) => Unsubscribe;
  peek: () => T;
}

export interface ComputedSignal<T> {
  get: Getter<T>;
  subscribe: (fn: Subscriber<T>) => Unsubscribe;
}

// Track current computation for auto-dependency tracking
let currentComputation: (() => void) | null = null;

// Batching state
let batchDepth = 0;
const pendingNotifications = new Set<() => void>();

/**
 * Create a reactive signal
 */
export function createSignal<T>(initialValue: T): Signal<T> {
  let value = initialValue;
  const subscribers = new Set<Subscriber<T>>();

  const get: Getter<T> = () => {
    // Track dependency if inside a computation
    if (currentComputation) {
      subscribers.add(currentComputation as Subscriber<T>);
    }
    return value;
  };

  const set: Setter<T> = (newValue) => {
    const nextValue =
      typeof newValue === "function" ? (newValue as (prev: T) => T)(value) : newValue;

    if (!Object.is(value, nextValue)) {
      value = nextValue;
      // Queue or execute notifications
      if (batchDepth > 0) {
        subscribers.forEach((fn) => pendingNotifications.add(() => fn(value)));
      } else {
        subscribers.forEach((fn) => fn(value));
      }
    }
  };

  const subscribe = (fn: Subscriber<T>): Unsubscribe => {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  };

  const peek = () => value;

  return { get, set, subscribe, peek };
}

/**
 * Create a computed signal that derives from other signals
 */
export function computed<T>(compute: () => T): ComputedSignal<T> {
  let cachedValue: T;
  let dirty = true;
  const subscribers = new Set<Subscriber<T>>();
  const dependencies = new Set<() => void>();

  // Called when a dependency changes - mark dirty and optionally recompute
  const markDirty = () => {
    dirty = true;
    // If we have subscribers, recompute immediately and notify
    if (subscribers.size > 0) {
      recompute();
    }
  };

  const recompute = () => {
    // Clear old dependency tracking
    dependencies.clear();

    const prev = currentComputation;
    currentComputation = markDirty;
    try {
      const newValue = compute();
      const changed = dirty || !Object.is(cachedValue, newValue);
      cachedValue = newValue;
      dirty = false;
      if (changed && subscribers.size > 0) {
        subscribers.forEach((fn) => fn(cachedValue));
      }
    } finally {
      currentComputation = prev;
    }
  };

  const get: Getter<T> = () => {
    if (dirty) {
      recompute();
    }
    if (currentComputation) {
      subscribers.add(currentComputation as Subscriber<T>);
    }
    return cachedValue;
  };

  const subscribe = (fn: Subscriber<T>): Unsubscribe => {
    subscribers.add(fn);
    // Initialize on first subscribe
    if (dirty) recompute();
    return () => subscribers.delete(fn);
  };

  return { get, subscribe };
}

/**
 * Create an effect that runs when its dependencies change
 */
export function effect(fn: () => void | (() => void)): Unsubscribe {
  let cleanup: (() => void) | void;

  const run = () => {
    if (cleanup) cleanup();
    const prev = currentComputation;
    currentComputation = run;
    try {
      cleanup = fn();
    } finally {
      currentComputation = prev;
    }
  };

  run();

  return () => {
    if (cleanup) cleanup();
  };
}

/**
 * Batch multiple signal updates into one notification cycle
 */
export function batch(fn: () => void): void {
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) {
      // Execute all pending notifications
      const notifications = [...pendingNotifications];
      pendingNotifications.clear();
      notifications.forEach((notify) => notify());
    }
  }
}
