import type { AuthRole } from "../core/types";
import {
  getClient,
  waitForSupabaseReady,
  signInWithGitHub as supabaseSignInWithGitHub,
  signOut as supabaseSignOut,
  onAuthStateChange as supabaseOnAuthStateChange,
} from "./supabase";

export interface AuthSession {
  sessionId: string;
  role: AuthRole;
  email: string | null;
  userId: string | null;
  isAuthenticated: boolean;
}

const SESSION_STORAGE_KEY = "dragonshoard_session_id";
const UNSAFE_ROLE_OVERRIDE_KEY = "dragonshoard_unsafe_role_override";

// Auth state change listeners
type AuthListener = (session: AuthSession) => void;
const authListeners: Set<AuthListener> = new Set();

function ensureSessionId(): string {
  if (typeof window === "undefined") return "server";
  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;
  let generated: string;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    generated = crypto.randomUUID();
  } else if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    // Manually generate a RFC4122 v4 UUID using crypto.getRandomValues
    // From: https://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Set version and variant bits as per RFC
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
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
    throw new Error(
      "Cryptographically secure random number generation is required but not available."
    );
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

async function loadSupabaseRole(): Promise<{
  role: AuthRole;
  email: string | null;
  userId: string | null;
}> {
  const ready = await waitForSupabaseReady();
  if (!ready) return { role: "anonymous", email: null, userId: null };

  const client = getClient() as unknown as {
    auth?: {
      getSession?: () => Promise<{
        data?: {
          session?: {
            user?: {
              id?: string;
              email?: string;
              app_metadata?: Record<string, unknown>;
              user_metadata?: Record<string, unknown>;
            };
          };
        };
      }>;
    };
  } | null;

  const session = await client?.auth?.getSession?.();
  const user = session?.data?.session?.user;

  if (!user) {
    return { role: "anonymous", email: null, userId: null };
  }

  const roleFromMetadata =
    user.app_metadata?.role || user.user_metadata?.role || "contributor"; // Authenticated users default to contributor

  return {
    role: sanitizeRole(roleFromMetadata),
    email: (user.email as string | undefined) ?? null,
    userId: user.id ?? null,
  };
}

export async function getAuthSession(): Promise<AuthSession> {
  const sessionId = ensureSessionId();
  const override =
    typeof window !== "undefined"
      ? sanitizeRole(window.localStorage.getItem(UNSAFE_ROLE_OVERRIDE_KEY))
      : "anonymous";
  const supabaseAuth = await loadSupabaseRole();

  return {
    sessionId,
    role: override !== "anonymous" ? override : supabaseAuth.role,
    email: supabaseAuth.email,
    userId: supabaseAuth.userId,
    isAuthenticated: supabaseAuth.userId !== null,
  };
}

export function buildAuthHeaders(session: AuthSession): Record<string, string> {
  return {
    "x-session-id": session.sessionId,
    "x-role": session.role,
    ...(session.email ? { "x-user-email": session.email } : {}),
    ...(session.userId ? { "x-user-id": session.userId } : {}),
  };
}

/**
 * Sign in with GitHub OAuth
 * Redirects to GitHub for authentication
 */
export async function signInWithGitHub(): Promise<void> {
  await supabaseSignInWithGitHub();
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  await supabaseSignOut();
  // Notify listeners of auth change
  const session = await getAuthSession();
  notifyAuthListeners(session);
}

/**
 * Subscribe to auth state changes
 * Returns unsubscribe function
 */
export function onAuthStateChange(callback: AuthListener): () => void {
  authListeners.add(callback);

  // Set up Supabase auth listener
  const unsubSupabase = supabaseOnAuthStateChange(async () => {
    const session = await getAuthSession();
    callback(session);
  });

  return () => {
    authListeners.delete(callback);
    unsubSupabase();
  };
}

function notifyAuthListeners(session: AuthSession): void {
  for (const listener of authListeners) {
    try {
      listener(session);
    } catch (e) {
      console.error("Auth listener error:", e);
    }
  }
}

/**
 * Check if user has moderator or admin role
 */
export async function isModerator(): Promise<boolean> {
  const session = await getAuthSession();
  return ["moderator", "admin"].includes(session.role);
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getAuthSession();
  return session.isAuthenticated;
}
