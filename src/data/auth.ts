import type { AuthRole } from "../core/types";
import { getClient, waitForSupabaseReady } from "./supabase";

export interface AuthSession {
  sessionId: string;
  role: AuthRole;
  email: string | null;
}

const SESSION_STORAGE_KEY = "dragonshoard_session_id";
const UNSAFE_ROLE_OVERRIDE_KEY = "dragonshoard_unsafe_role_override";

function ensureSessionId(): string {
  if (typeof window === "undefined") return "server";
  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;
  let generated: string;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    generated = crypto.randomUUID();
  } else if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    // Manually generate a RFC4122 v4 UUID using crypto.getRandomValues
    // From: https://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Set version and variant bits as per RFC
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    generated =
      hex.substr(0, 8) +
      "-" +
      hex.substr(8, 4) +
      "-" +
      hex.substr(12, 4) +
      "-" +
      hex.substr(16, 4) +
      "-" +
      hex.substr(20, 12);
  } else {
    throw new Error("Cryptographically secure random number generation is required but not available.");
  }
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
      ? sanitizeRole(window.localStorage.getItem(UNSAFE_ROLE_OVERRIDE_KEY))
      : "anonymous";
  const supabaseRole = await loadSupabaseRole();
  return { sessionId, role: override !== "anonymous" ? override : supabaseRole.role, email: supabaseRole.email };
}

export function buildAuthHeaders(session: AuthSession): Record<string, string> {
  return {
    "x-session-id": session.sessionId,
    "x-role": session.role,
    ...(session.email ? { "x-user-email": session.email } : {}),
  };
}
