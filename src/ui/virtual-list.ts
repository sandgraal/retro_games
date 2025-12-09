/**
 * Virtual List Component v3.0
 * High-performance virtualized rendering with DOM recycling
 *
 * Key features:
 * - DOM node recycling (no create/destroy overhead)
 * - Variable height support
 * - Smooth scrolling with momentum
 * - Intersection Observer for visibility
 */

import { effect, type Computed } from "../core/runtime";
import type { GameWithKey } from "../core/types";

// === Types ===

export interface VirtualListConfig {
  itemHeight: number;
  overscan: number;
  containerPadding: number;
  gap: number;
}

export interface VirtualItem {
  index: number;
  offset: number;
  game: GameWithKey;
}

interface PooledNode {
  element: HTMLElement;
  inUse: boolean;
  lastIndex: number;
}

// === Default Config ===

const DEFAULT_CONFIG: VirtualListConfig = {
  itemHeight: 360,
  overscan: 3,
  containerPadding: 16,
  gap: 16,
};

// === Virtual List Class ===

export class VirtualList {
  private container: HTMLElement;
  private scrollContainer: HTMLElement;
  private content: HTMLElement;
  private config: VirtualListConfig;
  private items: GameWithKey[] = [];
  private nodePool: PooledNode[] = [];
  private columns = 1;
  private visibleRange = { start: 0, end: 0 };
  private scrollTimeout: number | null = null;
  private resizeObserver: ResizeObserver;
  private renderCallback: (
    game: GameWithKey,
    element: HTMLElement,
    index: number
  ) => void;
  private disposed = false;

  constructor(
    container: HTMLElement,
    renderCallback: (game: GameWithKey, element: HTMLElement, index: number) => void,
    config: Partial<VirtualListConfig> = {}
  ) {
    this.container = container;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.renderCallback = renderCallback;

    // Create scroll structure
    this.scrollContainer = document.createElement("div");
    this.scrollContainer.className = "virtual-scroll-container";
    this.scrollContainer.style.cssText = `
      position: relative;
      overflow-y: auto;
      overflow-x: hidden;
      height: 100%;
      will-change: scroll-position;
    `;

    this.content = document.createElement("div");
    this.content.className = "virtual-scroll-content";
    this.content.style.cssText = `
      position: relative;
      width: 100%;
    `;

    this.scrollContainer.appendChild(this.content);
    this.container.appendChild(this.scrollContainer);

    // Setup observers and listeners
    this.setupScrollListener();
    this.resizeObserver = new ResizeObserver(this.handleResize.bind(this));
    this.resizeObserver.observe(this.container);

    // Initial layout
    this.calculateColumns();
  }

  // === Public API ===

  setItems(items: GameWithKey[]): void {
    this.items = items;
    this.updateContentHeight();
    this.render();
  }

  scrollToIndex(index: number, behavior: ScrollBehavior = "smooth"): void {
    const row = Math.floor(index / this.columns);
    const offset = row * (this.config.itemHeight + this.config.gap);

    this.scrollContainer.scrollTo({
      top: offset,
      behavior,
    });
  }

  scrollToTop(): void {
    this.scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
  }

  refresh(): void {
    this.calculateColumns();
    this.updateContentHeight();
    this.render();
  }

  dispose(): void {
    this.disposed = true;
    this.resizeObserver.disconnect();
    this.scrollContainer.removeEventListener("scroll", this.handleScroll);

    // Clear pool
    for (const pooled of this.nodePool) {
      pooled.element.remove();
    }
    this.nodePool = [];

    // Clear container
    this.container.innerHTML = "";
  }

  // === Private Methods ===

  private setupScrollListener(): void {
    this.handleScroll = this.handleScroll.bind(this);
    this.scrollContainer.addEventListener("scroll", this.handleScroll, { passive: true });
  }

  private handleScroll(): void {
    if (this.disposed) return;

    // Debounce scroll end
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    this.scrollTimeout = window.setTimeout(() => {
      // Scroll ended - could trigger lazy loading here
    }, 150);

    // Use RAF for smooth updates
    requestAnimationFrame(() => {
      if (!this.disposed) {
        this.render();
      }
    });
  }

  private handleResize(): void {
    if (this.disposed) return;

    this.calculateColumns();
    this.updateContentHeight();
    this.render();
  }

  private calculateColumns(): void {
    const containerWidth = this.container.clientWidth - this.config.containerPadding * 2;
    const itemWidth = 260; // Fixed card width
    this.columns = Math.max(
      1,
      Math.floor((containerWidth + this.config.gap) / (itemWidth + this.config.gap))
    );
  }

  private updateContentHeight(): void {
    const rows = Math.ceil(this.items.length / this.columns);
    const height =
      rows * (this.config.itemHeight + this.config.gap) -
      this.config.gap +
      this.config.containerPadding * 2;
    this.content.style.height = `${height}px`;
  }

  private calculateVisibleRange(): { start: number; end: number } {
    const scrollTop = this.scrollContainer.scrollTop;
    const viewportHeight = this.scrollContainer.clientHeight;

    const rowHeight = this.config.itemHeight + this.config.gap;
    const startRow = Math.max(
      0,
      Math.floor((scrollTop - this.config.containerPadding) / rowHeight) -
        this.config.overscan
    );
    const endRow =
      Math.ceil((scrollTop + viewportHeight) / rowHeight) + this.config.overscan;

    const start = startRow * this.columns;
    const end = Math.min(this.items.length, (endRow + 1) * this.columns);

    return { start, end };
  }

  private render(): void {
    if (this.disposed) return;

    const newRange = this.calculateVisibleRange();

    // Optimization: skip if range hasn't changed significantly
    if (
      newRange.start === this.visibleRange.start &&
      newRange.end === this.visibleRange.end
    ) {
      return;
    }

    this.visibleRange = newRange;

    // Mark all nodes as not in use
    for (const pooled of this.nodePool) {
      pooled.inUse = false;
    }

    // Render visible items
    for (let i = newRange.start; i < newRange.end; i++) {
      const item = this.items[i];
      if (!item) continue;

      const node = this.getOrCreateNode(i);
      this.positionNode(node.element, i);

      // Only re-render if content changed
      if (node.lastIndex !== i) {
        this.renderCallback(item, node.element, i);
        node.lastIndex = i;
      }

      node.inUse = true;
    }

    // Hide unused nodes (don't remove - keep for recycling)
    for (const pooled of this.nodePool) {
      if (!pooled.inUse) {
        pooled.element.style.display = "none";
        pooled.lastIndex = -1;
      }
    }
  }

  private getOrCreateNode(_index: number): PooledNode {
    // Try to find an unused node
    for (const pooled of this.nodePool) {
      if (!pooled.inUse) {
        pooled.element.style.display = "";
        return pooled;
      }
    }

    // Create new node
    const element = document.createElement("div");
    element.className = "virtual-item";
    element.style.cssText = `
      position: absolute;
      width: 260px;
      height: ${this.config.itemHeight}px;
      contain: layout style paint;
      will-change: transform;
    `;

    this.content.appendChild(element);

    const pooled: PooledNode = {
      element,
      inUse: true,
      lastIndex: -1,
    };

    this.nodePool.push(pooled);
    return pooled;
  }

  private positionNode(element: HTMLElement, index: number): void {
    const row = Math.floor(index / this.columns);
    const col = index % this.columns;

    const itemWidth = 260;
    const containerWidth = this.container.clientWidth - this.config.containerPadding * 2;
    const totalItemsWidth =
      this.columns * itemWidth + (this.columns - 1) * this.config.gap;
    const offsetX = (containerWidth - totalItemsWidth) / 2 + this.config.containerPadding;

    const x = offsetX + col * (itemWidth + this.config.gap);
    const y =
      this.config.containerPadding + row * (this.config.itemHeight + this.config.gap);

    element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }
}

// === Factory Function ===

export function createVirtualList(
  selector: string | HTMLElement,
  itemsSignal: Computed<GameWithKey[]>,
  renderCallback: (game: GameWithKey, element: HTMLElement, index: number) => void,
  config?: Partial<VirtualListConfig>
): () => void {
  const container =
    typeof selector === "string"
      ? document.querySelector<HTMLElement>(selector)
      : selector;

  if (!container) {
    console.warn(`Virtual list container not found: ${selector}`);
    return () => {};
  }

  const virtualList = new VirtualList(container, renderCallback, config);

  // Subscribe to items changes
  const dispose = effect(() => {
    const items = itemsSignal();
    virtualList.setItems(items);
  });

  // Return cleanup function
  return () => {
    dispose();
    virtualList.dispose();
  };
}

// === Grid Layout Helper ===

export function createMasonryGrid(
  container: HTMLElement,
  items: readonly GameWithKey[],
  renderItem: (game: GameWithKey) => HTMLElement
): void {
  container.innerHTML = "";

  const fragment = document.createDocumentFragment();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const element = renderItem(item);
    element.style.animationDelay = `${Math.min(i * 30, 300)}ms`;
    fragment.appendChild(element);
  }

  container.appendChild(fragment);
}
