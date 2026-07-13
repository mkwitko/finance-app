import * as SecureStore from "expo-secure-store";

// App JWTs live in the device keychain/keystore (expo-secure-store), never in plain
// AsyncStorage. We persist the access + refresh tokens plus the access-token expiry
// (epoch ms) so the client can pre-emptively refresh without decoding the JWT.
const ACCESS_KEY = "auth.accessToken";
const REFRESH_KEY = "auth.refreshToken";
const EXPIRES_KEY = "auth.accessExpiresAt";

export type StoredTokens = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
};

export async function saveTokens(t: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}): Promise<void> {
  const accessExpiresAt = Date.now() + t.expiresIn * 1000;
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, t.accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, t.refreshToken),
    SecureStore.setItemAsync(EXPIRES_KEY, String(accessExpiresAt)),
  ]);
}

export async function getTokens(): Promise<StoredTokens | null> {
  const [accessToken, refreshToken, expires] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
    SecureStore.getItemAsync(EXPIRES_KEY),
  ]);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken, accessExpiresAt: Number(expires ?? 0) };
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
    SecureStore.deleteItemAsync(EXPIRES_KEY),
  ]);
}
