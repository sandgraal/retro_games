/**
 * Community Suggestions Module
 * Handles community game submissions and moderation workflow
 */

import type { SuggestionRecord, AuditLogEntry } from "../core/types";
import { getAuthSession, buildAuthHeaders } from "./auth";

export interface ModerationDecision {
  action: "approve" | "reject";
  reason?: string;
}

/**
 * Generic HTTP send function that makes API requests
 * Returns suggestion with optional audit log entry
 */
async function send(
  endpoint: string,
  method: string,
  body?: unknown
): Promise<{ suggestion: SuggestionRecord; audit?: AuditLogEntry }> {
  const response = await fetch(endpoint, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Submit a moderation decision for a community suggestion
 * Returns suggestion with optional audit log (audit may be undefined if logging fails)
 */
export async function decideSuggestion(
  suggestionId: string,
  decision: ModerationDecision,
  moderatorEmail: string
): Promise<{ suggestion: SuggestionRecord; audit?: AuditLogEntry }> {
  const response = await send(`/api/suggestions/${suggestionId}/decide`, "POST", {
    ...decision,
    moderator_email: moderatorEmail,
  });

  // Return response as-is, audit may be undefined which is now correctly typed
  return {
    suggestion: response.suggestion,
    audit: response.audit,
  };
}

/**
 * Fetch all pending suggestions
 */
export async function fetchPendingSuggestions(): Promise<SuggestionRecord[]> {
  const response = await fetch("/api/suggestions?status=pending");
  if (!response.ok) {
    throw new Error(`Failed to fetch suggestions: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Submit a new game suggestion
 */
export async function submitSuggestion(
  gameName: string,
  platform: string,
  submitterEmail?: string
): Promise<SuggestionRecord> {
  const response = await fetch("/api/suggestions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      game_name: gameName,
      platform,
      submitter_email: submitterEmail,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit suggestion: ${response.statusText}`);
  }

  return response.json();
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
  const response = await fetch(`/api/v1/moderation/suggestions/${suggestionId}/decision`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(session),
    },
    body: JSON.stringify({ status, notes }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Alias for fetchPendingSuggestions - used by moderation UI
 */
export const fetchSuggestionsForModeration = fetchPendingSuggestions;
