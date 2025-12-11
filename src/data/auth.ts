import type { AuthRole } from "../core/types";
import { getClient, waitForSupabaseReady } from "./supabase";

export interface AuthSession {
  sessionId: string;
  role: AuthRole;
  email: string | null;
}

const SESSION_STORAGE_KEY = "dragonshoard_session_id";
const ROLE_OVERRIDE_KEY = "dragonshoard_role_override";

function ensureSessionId(): string {
  if (typeof window === "undefined") return "server";
  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;
  const generated =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `sess_${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(SESSION_STORAGE_KEY, generated);
  return generated;
}

function sanitizeRole(rawRole: unknown): AuthRole {
  const normalized = typeof rawRole === "string" ? rawRole.toLowerCase() : "anonymous";
  return ["anonymous", "contributor", "moderator", "admin"].includes(normalized)
    ? (normalized as AuthRole)
    : "anonymous";
}

async function loadSupabaseRole(): Promise<{ role: AuthRole; email: string | null }> {
  const ready = await waitForSupabaseReady();
  if (!ready) return { role: "anonymous", email: null };
  const client = getClient() as unknown as
    | {
        auth?: { getSession?: () => Promise<{ data?: { session?: { user?: any } } }> };
      }
    | null;
  const session = await client?.auth?.getSession?.();
  const user = session?.data?.session?.user;
  const roleFromMetadata =
    user?.app_metadata?.role || user?.user_metadata?.role || (user ? "contributor" : "anonymous");
  return {
    role: sanitizeRole(roleFromMetadata),
    email: (user?.email as string | undefined) ?? null,
  };
}

export async function getAuthSession(): Promise<AuthSession> {
  const sessionId = ensureSessionId();
  const override =
    typeof window !== "undefined"
      ? sanitizeRole(window.localStorage.getItem(ROLE_OVERRIDE_KEY))
      : "anonymous";
  const supabaseRole = await loadSupabaseRole();
  const role = override !== "anonymous" ? override : supabaseRole.role;
  return { sessionId, role, email: supabaseRole.email };
}

export function buildAuthHeaders(session: AuthSession): Record<string, string> {
  return {
    "x-session-id": session.sessionId,
    "x-role": session.role,
    ...(session.email ? { "x-user-email": session.email } : {}),
  };
}
