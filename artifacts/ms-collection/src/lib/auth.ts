/**
 * PIN Authentication Configuration and Session Management
 * 
 * This module handles screen-lock authentication for MS Collection.
 * It does NOT modify any business data, IndexedDB records, or financial logic.
 */

// ── Configuration ───────────────────────────────────────────────────

const AUTH_CONFIG = {
  PIN: "100699",
  SESSION_KEY: "ms_collection_auth",
  SESSION_DURATION_MS: 24 * 60 * 60 * 1000, // 24 hours
} as const;

// ── Types ───────────────────────────────────────────────────────────

interface AuthSession {
  authenticated: boolean;
  timestamp: number;
}

// ── Public API ──────────────────────────────────────────────────────

export function getPin(): string {
  return AUTH_CONFIG.PIN;
}

export function isAuthenticated(): boolean {
  try {
    const raw = sessionStorage.getItem(AUTH_CONFIG.SESSION_KEY);
    if (!raw) return false;

    const session: AuthSession = JSON.parse(raw);
    if (!session.authenticated) return false;

    const elapsed = Date.now() - session.timestamp;
    if (elapsed >= AUTH_CONFIG.SESSION_DURATION_MS) {
      // Session expired
      sessionStorage.removeItem(AUTH_CONFIG.SESSION_KEY);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function authenticate(): void {
  const session: AuthSession = {
    authenticated: true,
    timestamp: Date.now(),
  };
  try {
    sessionStorage.setItem(AUTH_CONFIG.SESSION_KEY, JSON.stringify(session));
  } catch {
    // sessionStorage may be unavailable in some environments
    console.warn('[Auth] Could not save session to sessionStorage');
  }
}

export function logout(): void {
  try {
    sessionStorage.removeItem(AUTH_CONFIG.SESSION_KEY);
  } catch {
    // ignore
  }
}

export function getTimeUntilExpiry(): number {
  try {
    const raw = sessionStorage.getItem(AUTH_CONFIG.SESSION_KEY);
    if (!raw) return 0;
    const session: AuthSession = JSON.parse(raw);
    const elapsed = Date.now() - session.timestamp;
    return Math.max(0, AUTH_CONFIG.SESSION_DURATION_MS - elapsed);
  } catch {
    return 0;
  }
}