import { env } from "@/env";
import { clearTokens, getTokens, saveTokens, type StoredTokens } from "./tokens";

// Session orchestration. Talks to the backend auth endpoints with RAW fetch (NOT the
// Kubb client — that client depends on this module for its Bearer token). Holds the
// refresh in a single in-flight promise so concurrent 401s trigger one refresh.

export type SessionUser = { sub: string; email: string; name: string };

type TokenResponse = { accessToken: string; refreshToken: string; expiresIn: number };

const listeners = new Set<() => void>();
/** Subscribe to auth-state changes (login / logout / refresh). Returns unsubscribe. */
export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function notify(): void {
  for (const l of listeners) l();
}

async function postAuth(path: string, body: unknown): Promise<TokenResponse> {
  const res = await fetch(`${env.apiUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { code?: string } | null;
    throw new Error(detail?.code ?? `auth_failed_${res.status}`);
  }
  return (await res.json()) as TokenResponse;
}

export async function loginWithGoogle(idToken: string): Promise<void> {
  await saveTokens(await postAuth("/auth/google", { idToken }));
  notify();
}

/** Development-only: log in by email without Google (backend gates to NODE_ENV=development). */
export async function devLogin(email: string, name?: string): Promise<void> {
  await saveTokens(await postAuth("/auth/dev-login", { email, name }));
  notify();
}

let refreshInFlight: Promise<StoredTokens | null> | null = null;
async function refreshSession(): Promise<StoredTokens | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const current = await getTokens();
    if (!current) return null;
    const res = await fetch(`${env.apiUrl}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    });
    if (!res.ok) {
      await forceLogout();
      return null;
    }
    await saveTokens((await res.json()) as TokenResponse);
    notify();
    return getTokens();
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/** Valid access token for an API call, refreshing pre-emptively. Null if signed out. */
export async function getJwtToken(): Promise<string | null> {
  const t = await getTokens();
  if (!t) return null;
  if (Date.now() < t.accessExpiresAt - 30_000) return t.accessToken;
  return (await refreshSession())?.accessToken ?? null;
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getTokens()) !== null;
}

/** Best-effort revoke on the server, then clear locally. */
export async function logout(): Promise<void> {
  const t = await getTokens();
  if (t) {
    await fetch(`${env.apiUrl}/auth/logout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: t.refreshToken }),
    }).catch(() => undefined);
  }
  await forceLogout();
}

/** Clear the local session and notify (used on hard 401s too). */
export async function forceLogout(): Promise<void> {
  await clearTokens();
  notify();
}

/** Decode the identity claims from the stored access token, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const t = await getTokens();
  if (!t) return null;
  try {
    const payload = t.accessToken.split(".")[1];
    if (!payload) return null;
    const json = decodeBase64Url(payload);
    const claims = JSON.parse(json) as SessionUser;
    return { sub: claims.sub, email: claims.email, name: claims.name };
  } catch {
    return null;
  }
}

function decodeBase64Url(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  // atob is available in Hermes / modern RN runtimes.
  return atob(padded);
}
