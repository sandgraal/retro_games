/**
 * Web Worker Pool
 * Offload heavy computations from main thread
 */

// === Worker Types ===

export interface WorkerTask<T = unknown, R = unknown> {
  id: string;
  type: string;
  payload: T;
  resolve: (result: R) => void;
  reject: (error: Error) => void;
}

export interface WorkerMessage<T = unknown> {
  id: string;
  type: string;
  payload: T;
}

export interface WorkerResponse<R = unknown> {
  id: string;
  success: boolean;
  result?: R;
  error?: string;
}

// === Worker Pool ===

class WorkerPool {
  private workers: Worker[] = [];
  private taskQueue: WorkerTask[] = [];
  private workerTasks = new Map<Worker, WorkerTask | null>();
  private workerCode: string;

  constructor(private poolSize: number = navigator.hardwareConcurrency || 4) {
    this.workerCode = this.createWorkerCode();
  }

  private createWorkerCode(): string {
    return `
      // Worker task handlers
      const handlers = {
        // Filter games
        filterGames: ({ games, filters }) => {
          let result = [...games];
          
          if (filters.platforms?.size > 0) {
            result = result.filter(g => filters.platforms.has(g.platform));
          }
          
          if (filters.genres?.size > 0) {
            result = result.filter(g => {
              const gameGenres = (g.genre || '').split(',').map(s => s.trim());
              return gameGenres.some(genre => filters.genres.has(genre));
            });
          }
          
          if (filters.searchQuery) {
            const query = filters.searchQuery.toLowerCase();
            result = result.filter(g => {
              const searchable = [g.game_name, g.platform, g.genre, g.region]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
              return searchable.includes(query);
            });
          }
          
          if (filters.yearRange?.start != null) {
            result = result.filter(g => {
              const year = parseInt(String(g.release_year), 10);
              return !isNaN(year) && year >= filters.yearRange.start;
            });
          }
          
          if (filters.yearRange?.end != null) {
            result = result.filter(g => {
              const year = parseInt(String(g.release_year), 10);
              return !isNaN(year) && year <= filters.yearRange.end;
            });
          }
          
          if (filters.ratingRange?.min > 0) {
            result = result.filter(g => {
              const rating = parseFloat(String(g.rating));
              return !isNaN(rating) && rating >= filters.ratingRange.min;
            });
          }
          
          return result;
        },
        
        // Sort games
        sortGames: ({ games, sortBy, sortDirection }) => {
          const result = [...games];
          result.sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
              case 'name':
                comparison = (a.game_name || '').localeCompare(b.game_name || '');
                break;
              case 'rating': {
                const ratingA = parseFloat(String(a.rating)) || 0;
                const ratingB = parseFloat(String(b.rating)) || 0;
                comparison = ratingA - ratingB;
                break;
              }
              case 'year': {
                const yearA = parseInt(String(a.release_year), 10) || 0;
                const yearB = parseInt(String(b.release_year), 10) || 0;
                comparison = yearA - yearB;
                break;
              }
              case 'platform':
                comparison = (a.platform || '').localeCompare(b.platform || '');
                break;
            }
            return sortDirection === 'desc' ? -comparison : comparison;
          });
          return result;
        },
        
        // Compute statistics
        computeStats: ({ games, collection }) => {
          const collectionMap = new Map(Object.entries(collection || {}));
          
          const statusCounts = { owned: 0, wishlist: 0, backlog: 0, trade: 0 };
          const platformBreakdown = new Map();
          const genreBreakdown = new Map();
          let totalValue = 0;
          let ratingSum = 0;
          let ratingCount = 0;
          
          for (const [key, entry] of collectionMap) {
            if (entry.status && entry.status !== 'none') {
              statusCounts[entry.status] = (statusCounts[entry.status] || 0) + 1;
              
              const game = games.find(g => g.key === key);
              if (game && entry.status === 'owned') {
                // Platform
                const pCount = platformBreakdown.get(game.platform) || 0;
                platformBreakdown.set(game.platform, pCount + 1);
                
                // Genre
                (game.genre || '').split(',').forEach(genre => {
                  const trimmed = genre.trim();
                  if (trimmed) {
                    const gCount = genreBreakdown.get(trimmed) || 0;
                    genreBreakdown.set(trimmed, gCount + 1);
                  }
                });
                
                // Rating
                const rating = parseFloat(String(game.rating));
                if (!isNaN(rating)) {
                  ratingSum += rating;
                  ratingCount++;
                }
              }
            }
          }
          
          return {
            totalGames: games.length,
            ...statusCounts,
            totalValue,
            platformBreakdown: Object.fromEntries(platformBreakdown),
            genreBreakdown: Object.fromEntries(genreBreakdown),
            averageRating: ratingCount > 0 ? ratingSum / ratingCount : 0,
          };
        },
        
        // Search with fuzzy matching
        fuzzySearch: ({ games, query, limit = 50 }) => {
          if (!query) return games.slice(0, limit);
          
          const queryLower = query.toLowerCase();
          const queryChars = queryLower.split('');
          
          const scored = games.map(game => {
            const name = (game.game_name || '').toLowerCase();
            
            // Exact match
            if (name === queryLower) return { game, score: 1000 };
            
            // Starts with
            if (name.startsWith(queryLower)) return { game, score: 500 + (100 - name.length) };
            
            // Contains
            if (name.includes(queryLower)) return { game, score: 200 };
            
            // Fuzzy match
            let score = 0;
            let lastIndex = -1;
            for (const char of queryChars) {
              const index = name.indexOf(char, lastIndex + 1);
              if (index === -1) break;
              score += 10 - Math.min(9, index - lastIndex - 1);
              lastIndex = index;
            }
            
            return { game, score };
          });
          
          return scored
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(s => s.game);
        },
        
        // Generate CSV
        generateCSV: ({ games, collection, columns }) => {
          const collectionMap = new Map(Object.entries(collection || {}));
          const headers = columns || ['game_name', 'platform', 'genre', 'rating', 'release_year', 'status'];
          
          const escape = (value) => {
            if (!value) return '';
            const str = String(value);
            if (/[,"\\n\\r]/.test(str)) {
              return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
          };
          
          const rows = [headers.join(',')];
          
          for (const game of games) {
            const entry = collectionMap.get(game.key);
            const status = entry?.status || 'none';
            if (status === 'none') continue;
            
            const row = headers.map(col => {
              if (col === 'status') return status;
              return escape(game[col]);
            });
            rows.push(row.join(','));
          }
          
          return rows.join('\\n');
        },
        
        // Parse CSV
        parseCSV: ({ content }) => {
          const lines = content.split(/\\r?\\n/);
          if (lines.length < 2) return [];
          
          const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
          const results = [];
          
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Simple CSV parsing (doesn't handle all edge cases)
            const values = line.split(',');
            const obj = {};
            
            headers.forEach((header, index) => {
              obj[header] = (values[index] || '').replace(/^"|"$/g, '');
            });
            
            results.push(obj);
          }
          
          return results;
        },
        
        // Aggregate by field
        aggregate: ({ games, field }) => {
          const counts = new Map();
          
          for (const game of games) {
            let values = game[field];
            if (!values) continue;
            
            // Handle comma-separated values (like genre)
            const items = String(values).split(',').map(s => s.trim()).filter(Boolean);
            
            for (const item of items) {
              counts.set(item, (counts.get(item) || 0) + 1);
            }
          }
          
          return Object.fromEntries(
            [...counts.entries()].sort((a, b) => b[1] - a[1])
          );
        },
      };
      
      // Message handler
      self.onmessage = async (e) => {
        const { id, type, payload } = e.data;
        
        try {
          const handler = handlers[type];
          if (!handler) {
            throw new Error('Unknown task type: ' + type);
          }
          
          const result = await handler(payload);
          self.postMessage({ id, success: true, result });
        } catch (error) {
          self.postMessage({ id, success: false, error: error.message });
        }
      };
    `;
  }

  private getIdleWorker(): Worker | null {
    for (const [worker, task] of this.workerTasks) {
      if (!task) return worker;
    }
    return null;
  }

  private spawnWorker(): Worker {
    const blob = new Blob([this.workerCode], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const response = e.data;
      const task = this.workerTasks.get(worker);

      if (task && task.id === response.id) {
        if (response.success) {
          task.resolve(response.result);
        } else {
          task.reject(new Error(response.error || "Worker task failed"));
        }

        // Mark worker as idle
        this.workerTasks.set(worker, null);

        // Process next task in queue
        this.processQueue();
      }
    };

    worker.onerror = (e) => {
      const task = this.workerTasks.get(worker);
      if (task) {
        task.reject(new Error(`Worker error: ${e.message}`));
        this.workerTasks.set(worker, null);
      }

      // Replace crashed worker
      this.workers = this.workers.filter((w) => w !== worker);
      this.workerTasks.delete(worker);
      worker.terminate();
    };

    this.workers.push(worker);
    this.workerTasks.set(worker, null);

    return worker;
  }

  private processQueue(): void {
    if (this.taskQueue.length === 0) return;

    let worker = this.getIdleWorker();

    if (!worker && this.workers.length < this.poolSize) {
      worker = this.spawnWorker();
    }

    if (!worker) return;

    const task = this.taskQueue.shift()!;
    this.workerTasks.set(worker, task);

    worker.postMessage({
      id: task.id,
      type: task.type,
      payload: task.payload,
    });
  }

  async run<T, R>(type: string, payload: T): Promise<R> {
    return new Promise((resolve, reject) => {
      const task: WorkerTask<T, R> = {
        id: crypto.randomUUID(),
        type,
        payload,
        resolve,
        reject,
      };

      this.taskQueue.push(task as WorkerTask);
      this.processQueue();
    });
  }

  terminate(): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.workerTasks.clear();
    this.taskQueue = [];
  }
}

// === Singleton Export ===

let pool: WorkerPool | null = null;

export function getWorkerPool(): WorkerPool {
  if (!pool) {
    pool = new WorkerPool();
  }
  return pool;
}

// === Task Helpers ===

export async function filterGames<T>(games: T[], filters: unknown): Promise<T[]> {
  // For small datasets, run on main thread
  if (games.length < 500) {
    return filterGamesSync(games, filters);
  }

  return getWorkerPool().run("filterGames", { games, filters });
}

export async function sortGames<T>(
  games: T[],
  sortBy: string,
  sortDirection: "asc" | "desc"
): Promise<T[]> {
  if (games.length < 500) {
    return sortGamesSync(games, sortBy, sortDirection);
  }

  return getWorkerPool().run("sortGames", { games, sortBy, sortDirection });
}

export async function computeStats<T>(
  games: T[],
  collection: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return getWorkerPool().run("computeStats", { games, collection });
}

export async function fuzzySearch<T>(
  games: T[],
  query: string,
  limit?: number
): Promise<T[]> {
  if (games.length < 1000) {
    return fuzzySearchSync(games, query, limit);
  }

  return getWorkerPool().run("fuzzySearch", { games, query, limit });
}

export async function generateCSV<T>(
  games: T[],
  collection: Record<string, unknown>,
  columns?: string[]
): Promise<string> {
  return getWorkerPool().run("generateCSV", { games, collection, columns });
}

export async function parseCSV(content: string): Promise<Record<string, string>[]> {
  return getWorkerPool().run("parseCSV", { content });
}

export async function aggregate<T>(
  games: T[],
  field: string
): Promise<Record<string, number>> {
  return getWorkerPool().run("aggregate", { games, field });
}

// === Sync Fallbacks (for small datasets) ===

function filterGamesSync<T>(games: T[], filters: any): T[] {
  let result = [...games];

  if (filters.platforms?.size > 0) {
    result = result.filter((g: any) => filters.platforms.has(g.platform));
  }

  if (filters.genres?.size > 0) {
    result = result.filter((g: any) => {
      const gameGenres = (g.genre || "").split(",").map((s: string) => s.trim());
      return gameGenres.some((genre: string) => filters.genres.has(genre));
    });
  }

  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    result = result.filter((g: any) => {
      const searchable = [g.game_name, g.platform, g.genre, g.region]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(query);
    });
  }

  return result;
}

function sortGamesSync<T>(
  games: T[],
  sortBy: string,
  sortDirection: "asc" | "desc"
): T[] {
  const result = [...games];
  result.sort((a: any, b: any) => {
    let comparison = 0;
    switch (sortBy) {
      case "name":
        comparison = (a.game_name || "").localeCompare(b.game_name || "");
        break;
      case "rating":
        comparison = (parseFloat(a.rating) || 0) - (parseFloat(b.rating) || 0);
        break;
      case "year":
        comparison = (parseInt(a.release_year) || 0) - (parseInt(b.release_year) || 0);
        break;
      case "platform":
        comparison = (a.platform || "").localeCompare(b.platform || "");
        break;
    }
    return sortDirection === "desc" ? -comparison : comparison;
  });
  return result;
}

function fuzzySearchSync<T>(games: T[], query: string, limit = 50): T[] {
  if (!query) return games.slice(0, limit);

  const queryLower = query.toLowerCase();

  return games
    .filter((g: any) => {
      const name = (g.game_name || "").toLowerCase();
      return name.includes(queryLower);
    })
    .slice(0, limit);
}
