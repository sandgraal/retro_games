import type { AuditLogEntry, SuggestionRecord } from "../core/types";
import { buildAuthHeaders, getAuthSession } from "./auth";

const API_BASE = "/api/v1";

async function send<T>(path: string, options: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Request failed: ${response.status}: ${detail}`);
  }
  return response.json() as Promise<T>;
}

export async function submitGameSuggestion(
  gameKey: string,
  delta: Record<string, unknown>,
  notes?: string
): Promise<SuggestionRecord> {
  const session = await getAuthSession();
  const body = JSON.stringify({ delta, notes });
  const { suggestion } = await send<{ suggestion: SuggestionRecord }>(
    `/games/${encodeURIComponent(gameKey)}/suggestions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildAuthHeaders(session),
      },
      body,
    }
  );
  return suggestion;
}

export async function submitNewGameSuggestion(
  delta: Record<string, unknown>,
  notes?: string
): Promise<SuggestionRecord> {
  const session = await getAuthSession();
  const body = JSON.stringify({ delta, notes });
  const { suggestion } = await send<{ suggestion: SuggestionRecord }>("/games/new", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(session),
    },
    body,
  });
  return suggestion;
}

export async function fetchSuggestionsForModeration(): Promise<SuggestionRecord[]> {
  const session = await getAuthSession();
  const { suggestions } = await send<{ suggestions: SuggestionRecord[] }>(
    "/moderation/suggestions",
    {
      headers: buildAuthHeaders(session),
    }
  );
  return suggestions;
}

export async function decideSuggestion(
  suggestionId: string,
  status: "approved" | "rejected",
  notes?: string
): Promise<{ suggestion: SuggestionRecord; audit: AuditLogEntry }> {
  const session = await getAuthSession();
  const payload = JSON.stringify({ status, notes });
  const response = await send<{ suggestion: SuggestionRecord; audit?: AuditLogEntry }>(
    `/moderation/suggestions/${suggestionId}/decision`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildAuthHeaders(session),
      },
      body: payload,
    }
  );
  return { suggestion: response.suggestion, audit: response.audit };
}
