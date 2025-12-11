/**
 * Supabase Client for Catalog Ingest Service
 *
 * This module provides database connectivity for the catalog ingestion pipeline.
 * Uses service role key for server-side operations (not for client-side use).
 */

/**
 * Get Supabase configuration from environment
 * @returns {{url: string, serviceKey: string, enabled: boolean}}
 */
function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  return {
    url: url || "",
    serviceKey: serviceKey || "",
    enabled: Boolean(url && serviceKey),
  };
}

/**
 * Create headers for Supabase REST API calls
 * @param {string} serviceKey - Supabase service role key
 * @returns {Record<string, string>}
 */
function createHeaders(serviceKey) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

/**
 * Initialize Supabase connection
 * @returns {{enabled: boolean, client: object | null}}
 */
export function initSupabase() {
  const config = getSupabaseConfig();

  if (!config.enabled) {
    console.log("[supabase] Supabase not configured - using local JSON storage");
    return { enabled: false, client: null };
  }

  console.log("[supabase] Supabase connection enabled");
  return {
    enabled: true,
    client: createClient(config.url, config.serviceKey),
  };
}

/**
 * Create a minimal Supabase client for REST API operations
 * @param {string} url - Supabase project URL
 * @param {string} serviceKey - Service role key
 * @returns {object} Client with table operations
 */
function createClient(url, serviceKey) {
  const headers = createHeaders(serviceKey);
  const restUrl = `${url}/rest/v1`;

  return {
    url,
    serviceKey,
    headers,

    /**
     * Select from a table
     * @param {string} table - Table name
     * @param {object} options - Query options
     * @returns {Promise<{data: any[], error: Error | null}>}
     */
    async select(table, options = {}) {
      const params = new URLSearchParams();

      if (options.columns) {
        params.set("select", options.columns);
      }

      if (options.filters) {
        for (const [key, value] of Object.entries(options.filters)) {
          params.set(key, `eq.${value}`);
        }
      }

      if (options.limit) {
        params.set("limit", String(options.limit));
      }

      if (options.offset) {
        params.set("offset", String(options.offset));
      }

      if (options.order) {
        params.set("order", options.order);
      }

      try {
        const response = await fetch(`${restUrl}/${table}?${params}`, { headers });
        if (!response.ok) {
          const error = await response.text();
          return { data: null, error: new Error(error) };
        }
        const data = await response.json();
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    /**
     * Insert into a table
     * @param {string} table - Table name
     * @param {object | object[]} data - Data to insert
     * @returns {Promise<{data: any, error: Error | null}>}
     */
    async insert(table, data) {
      try {
        const response = await fetch(`${restUrl}/${table}`, {
          method: "POST",
          headers,
          body: JSON.stringify(data),
        });
        if (!response.ok) {
          const error = await response.text();
          return { data: null, error: new Error(error) };
        }
        const result = await response.json();
        return { data: result, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    /**
     * Update records in a table
     * @param {string} table - Table name
     * @param {object} data - Data to update
     * @param {object} filters - Filter conditions
     * @returns {Promise<{data: any, error: Error | null}>}
     */
    async update(table, data, filters) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
        params.set(key, `eq.${value}`);
      }

      try {
        const response = await fetch(`${restUrl}/${table}?${params}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(data),
        });
        if (!response.ok) {
          const error = await response.text();
          return { data: null, error: new Error(error) };
        }
        const result = await response.json();
        return { data: result, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    /**
     * Upsert (insert or update on conflict)
     * @param {string} table - Table name
     * @param {object | object[]} data - Data to upsert
     * @param {string} onConflict - Conflict resolution column(s)
     * @returns {Promise<{data: any, error: Error | null}>}
     */
    async upsert(table, data, onConflict = "id") {
      try {
        const upsertHeaders = {
          ...headers,
          Prefer: "resolution=merge-duplicates,return=representation",
        };
        const response = await fetch(`${restUrl}/${table}?on_conflict=${onConflict}`, {
          method: "POST",
          headers: upsertHeaders,
          body: JSON.stringify(data),
        });
        if (!response.ok) {
          const error = await response.text();
          return { data: null, error: new Error(error) };
        }
        const result = await response.json();
        return { data: result, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },

    /**
     * Call a database function (RPC)
     * @param {string} fn - Function name
     * @param {object} params - Function parameters
     * @returns {Promise<{data: any, error: Error | null}>}
     */
    async rpc(fn, params = {}) {
      try {
        const response = await fetch(`${restUrl}/rpc/${fn}`, {
          method: "POST",
          headers,
          body: JSON.stringify(params),
        });
        if (!response.ok) {
          const error = await response.text();
          return { data: null, error: new Error(error) };
        }
        const result = await response.json();
        return { data: result, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
  };
}

// =====================================================
// CATALOG SUBMISSION OPERATIONS
// =====================================================

/**
 * Insert a catalog submission into Supabase
 * @param {object} client - Supabase client
 * @param {object} suggestion - Suggestion data
 * @returns {Promise<{data: any, error: Error | null}>}
 */
export async function insertSubmission(client, suggestion) {
  if (!client) return { data: null, error: new Error("Supabase not configured") };

  const submission = {
    game_id: suggestion.targetId || null,
    user_id: suggestion.author?.sessionId || null,
    submission_type: suggestion.type === "update" ? "edit" : suggestion.type,
    payload: {
      delta: suggestion.delta,
      notes: suggestion.notes,
    },
    status: suggestion.status || "pending",
  };

  return client.insert("catalog_submissions", submission);
}

/**
 * Fetch pending submissions from Supabase
 * @param {object} client - Supabase client
 * @param {string} status - Filter by status
 * @returns {Promise<{data: any[], error: Error | null}>}
 */
export async function fetchSubmissions(client, status = "pending") {
  if (!client) return { data: [], error: new Error("Supabase not configured") };

  return client.select("catalog_submissions", {
    filters: { status },
    order: "created_at.desc",
    limit: 100,
  });
}

/**
 * Update submission decision
 * @param {object} client - Supabase client
 * @param {string} submissionId - Submission ID
 * @param {string} status - New status
 * @param {string} reviewerId - Reviewer ID
 * @param {string} notes - Review notes
 * @returns {Promise<{data: any, error: Error | null}>}
 */
export async function updateSubmissionDecision(
  client,
  submissionId,
  status,
  reviewerId,
  notes
) {
  if (!client) return { data: null, error: new Error("Supabase not configured") };

  return client.update(
    "catalog_submissions",
    {
      status,
      reviewer_id: reviewerId,
      reviewer_notes: notes,
      reviewed_at: new Date().toISOString(),
      ...(status === "merged" ? { merged_at: new Date().toISOString() } : {}),
    },
    { id: submissionId }
  );
}

// =====================================================
// AUDIT LOG OPERATIONS
// =====================================================

/**
 * Insert an audit log entry
 * @param {object} client - Supabase client
 * @param {object} entry - Audit entry
 * @returns {Promise<{data: any, error: Error | null}>}
 */
export async function insertAuditLog(client, entry) {
  if (!client) return { data: null, error: new Error("Supabase not configured") };

  return client.insert("audit_log", {
    table_name: entry.tableName || "catalog_submissions",
    record_id: entry.recordId,
    action: entry.action,
    old_data: entry.oldData || null,
    new_data: entry.newData || null,
    user_id: entry.userId || null,
    reason: entry.reason || null,
  });
}

// =====================================================
// INGESTION RUN OPERATIONS
// =====================================================

/**
 * Start a new ingestion run
 * @param {object} client - Supabase client
 * @param {string} source - Source name
 * @returns {Promise<{data: {id: string} | null, error: Error | null}>}
 */
export async function startIngestionRun(client, source) {
  if (!client) return { data: null, error: new Error("Supabase not configured") };

  return client.insert("ingestion_runs", {
    source,
    status: "running",
    records_processed: 0,
    records_added: 0,
    records_updated: 0,
  });
}

/**
 * Update ingestion run progress
 * @param {object} client - Supabase client
 * @param {string} runId - Ingestion run ID
 * @param {object} metrics - Progress metrics
 * @returns {Promise<{data: any, error: Error | null}>}
 */
export async function updateIngestionRun(client, runId, metrics) {
  if (!client) return { data: null, error: new Error("Supabase not configured") };

  return client.update(
    "ingestion_runs",
    {
      records_processed: metrics.processed || 0,
      records_added: metrics.added || 0,
      records_updated: metrics.updated || 0,
    },
    { id: runId }
  );
}

/**
 * Complete an ingestion run
 * @param {object} client - Supabase client
 * @param {string} runId - Ingestion run ID
 * @param {object} finalMetrics - Final metrics
 * @param {string} error - Error message if failed
 * @returns {Promise<{data: any, error: Error | null}>}
 */
export async function completeIngestionRun(client, runId, finalMetrics, error = null) {
  if (!client) return { data: null, error: new Error("Supabase not configured") };

  return client.update(
    "ingestion_runs",
    {
      status: error ? "failed" : "completed",
      completed_at: new Date().toISOString(),
      records_processed: finalMetrics.processed || 0,
      records_added: finalMetrics.added || 0,
      records_updated: finalMetrics.updated || 0,
      error_message: error,
    },
    { id: runId }
  );
}

// =====================================================
// GAME SYNC OPERATIONS
// =====================================================

/**
 * Upsert games to Supabase from catalog store
 * @param {object} client - Supabase client
 * @param {object[]} games - Games to sync
 * @returns {Promise<{synced: number, errors: Error[]}>}
 */
export async function syncGamesToSupabase(client, games) {
  if (!client) return { synced: 0, errors: [new Error("Supabase not configured")] };

  const errors = [];
  let synced = 0;

  // Process in batches of 100
  const batchSize = 100;
  for (let i = 0; i < games.length; i += batchSize) {
    const batch = games.slice(i, i + batchSize);

    const transformedBatch = batch.map((game) => ({
      game_name: game.title || game.game_name,
      platform: game.platform,
      genre: Array.isArray(game.genres) ? game.genres.join(", ") : game.genres || "",
      rating: game.esrb || "",
      release_year: game.release_date
        ? String(new Date(game.release_date).getUTCFullYear())
        : "",
      cover: game.assets?.cover || "",
      region: Array.isArray(game.regions) ? game.regions.join(", ") : game.regions || "",
    }));

    const { data, error } = await client.upsert(
      "games",
      transformedBatch,
      "game_name,platform"
    );

    if (error) {
      errors.push(error);
    } else {
      synced += data?.length || batch.length;
    }
  }

  return { synced, errors };
}

/**
 * Sync external IDs for games
 * @param {object} client - Supabase client
 * @param {string} gameId - Game UUID
 * @param {object} externalIds - External IDs object
 * @returns {Promise<{data: any, error: Error | null}>}
 */
export async function syncExternalIds(client, gameId, externalIds) {
  if (!client) return { data: null, error: new Error("Supabase not configured") };

  const entries = [];
  for (const [source, externalId] of Object.entries(externalIds)) {
    if (externalId) {
      entries.push({
        game_id: gameId,
        source,
        external_id: String(externalId),
        last_synced: new Date().toISOString(),
      });
    }
  }

  if (entries.length === 0) return { data: [], error: null };

  return client.upsert("game_external_ids", entries, "game_id,source");
}

export default {
  initSupabase,
  insertSubmission,
  fetchSubmissions,
  updateSubmissionDecision,
  insertAuditLog,
  startIngestionRun,
  updateIngestionRun,
  completeIngestionRun,
  syncGamesToSupabase,
  syncExternalIds,
};
