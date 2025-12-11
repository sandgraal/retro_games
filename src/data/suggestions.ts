/**
 * Community Suggestions Module
 * Handles community game submissions and moderation workflow
 */

import type { SuggestionRecord, AuditLogEntry } from "../core/types";
import { getAuthSession, buildAuthHeaders } from "./auth";

export type { SuggestionRecord, AuditLogEntry };

export interface ModerationDecision {
  action: "approve" | "reject";
  reason?: string;
}

/**
 * Fetch all pending suggestions for moderation
 * Requires moderator or admin role
 */
export async function fetchPendingSuggestions(): Promise<SuggestionRecord[]> {
  const session = await getAuthSession();
  const response = await fetch("/api/v1/moderation/suggestions?status=pending", {
    headers: buildAuthHeaders(session),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch suggestions: ${response.statusText}`);
  }
  const result = await response.json();
  return result.suggestions || [];
}

/**
 * Submit a moderation decision with authentication
 * Used by the moderation UI - authenticates the moderator and logs the decision
 */
export async function moderateSuggestion(
  suggestionId: string,
  status: "approved" | "rejected",
  notes?: string
): Promise<{ suggestion: SuggestionRecord; audit: AuditLogEntry }> {
  const session = await getAuthSession();
  const response = await fetch(
    `/api/v1/moderation/suggestions/${suggestionId}/decision`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildAuthHeaders(session),
      },
      body: JSON.stringify({ status, notes }),
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Alias for fetchPendingSuggestions - used by moderation UI
 */
export const fetchSuggestionsForModeration = fetchPendingSuggestions;

/**
 * Submit an edit suggestion for an existing game
 * Used by the "Suggest Edit" UI in the game modal
 */
export async function submitEditSuggestion(
  gameKey: string,
  delta: Record<string, unknown>,
  notes?: string
): Promise<SuggestionRecord> {
  const session = await getAuthSession();
  const response = await fetch(
    `/api/v1/games/${encodeURIComponent(gameKey)}/suggestions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildAuthHeaders(session),
      },
      body: JSON.stringify({ delta, notes }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();
  return result.suggestion;
}

/**
 * Submit a new game suggestion
 * Used when suggesting a game that doesn't exist in the catalog
 */
export async function submitNewGameSuggestion(
  gameData: {
    game_name: string;
    platform: string;
    genre?: string;
    release_year?: number | string;
    region?: string;
    developer?: string;
    publisher?: string;
    description?: string;
  },
  notes?: string
): Promise<SuggestionRecord> {
  const session = await getAuthSession();
  const response = await fetch("/api/v1/games/new", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(session),
    },
    body: JSON.stringify({ delta: gameData, notes }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();
  return result.suggestion;
}
