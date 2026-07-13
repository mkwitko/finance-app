# AUTH.md — Autenticação (JWT próprio + Google Sign-In)

> **Sem Cognito, sem Amplify.** A autenticação é **JWT emitido pelo nosso backend Fastify** + **login com Google**. O app pega um `idToken` do Google (via Google Sign-In), manda pro backend, e o backend devolve um **access token (JWT curto)** + **refresh token** próprios. Esses tokens vivem em `expo-secure-store` e vão em `Authorization: Bearer <accessToken>` nas chamadas de API.
>
> **Expo mudou.** Confira a doc do Expo SDK 57 (`expo-secure-store`, Google Sign-In, deep linking) em https://docs.expo.dev/versions/v57.0.0/ antes de mexer aqui.

**Sem auto-cadastro clássico.** Não há tela de e-mail/senha, `signUp`, `confirmSignUp` nem `forgotPassword`. O único caminho de entrada é **Google**. O primeiro login com Google provisiona o usuário no backend (upsert por `sub`/e-mail Google).

**O backend é a autoridade.** Ele verifica o `idToken` do Google, cria/atualiza o usuário e assina o JWT do app. O app **não** valida assinatura de token localmente — só lê claims do access token para UX (nome, e-mail).

**Sem autorização por papel.** Este projeto não usa personas/roles — o acesso é gated só por autenticação (logado ou não). Não há claim `authorities`, `useCan`, nem catálogo de permissões (ver [`PERMISSIONS.md`](./PERMISSIONS.md)).

---

## 1. Modelo

```
[Usuário não autenticado abre o app]
        ↓
[Guard <Stack.Protected guard={isLoggedIn}> manda pro grupo (auth)/]
        ↓
[Tela (auth)/sign-in → botão "Entrar com Google"]
        ↓
[GoogleSignin.signIn() → browser nativo do Google → idToken do Google]
        ↓
[POST {API}/auth/google { idToken }]
        ↓
[Backend verifica o idToken com o Google, upsert do usuário]
        ↓
[Backend responde { accessToken, refreshToken, expiresIn }]  ← JWT NOSSO
        ↓
[Tokens gravados em expo-secure-store]
        ↓
[Decode do access token → payload.sub/email/name → User]
        ↓
[Guard reavalia → grupo (tabs)/ → app funcional]
```

**Pontos importantes:**
- **Login = Google.** `@react-native-google-signin/google-signin` abre o fluxo nativo do Google e devolve um `idToken`. Esse token é do **Google**, efêmero, usado só para provar identidade ao backend.
- **A sessão do app é JWT nosso.** Quem manda no acesso à API é o **access token assinado pelo backend** (não o token do Google). Ele carrega só identidade: `sub`, `email`, `name`.
- **Refresh próprio.** Access token curto (~15 min). Ao expirar, trocamos por um novo via `POST /auth/refresh` com o refresh token. Sem refresh válido → `forceLogout()`.
- **Tokens em `expo-secure-store`** (Keychain iOS / Keystore Android), nunca `AsyncStorage`/`useState`.
- **`Authorization: Bearer <accessToken>`** — com prefixo `Bearer` (é JWT nosso, convenção padrão do `@fastify/jwt` no backend).
- **Guard de auth é Expo Router `<Stack.Protected>`** — ver [`NAVIGATION.md`](./NAVIGATION.md).

> **Contrato com o backend** (ver a skill do backend): `POST /auth/google { idToken }` → `{ accessToken, refreshToken, expiresIn }`; `POST /auth/refresh { refreshToken }` → novos tokens (rotação); `POST /auth/logout { refreshToken }` → revoga; `GET /me` → usuário atual. O access token carrega só identidade (`sub`/`email`/`name`) — sem claim de papéis (ver [`PERMISSIONS.md`](./PERMISSIONS.md)).

---

## 2. Setup

```bash
npx expo install expo-secure-store @react-native-google-signin/google-signin
pnpm add jwt-decode
```

> `@react-native-google-signin/google-signin` traz código nativo e um **config plugin** — exige **dev client** (não roda no Expo Go). `expo-auth-session/providers/google` (browser-based) é a alternativa; ficamos com o SDK nativo porque devolve o `idToken` direto e é o caminho recomendado pelo Expo no SDK 57.

### 2.1 `app.json` — scheme, plugin e client IDs

```jsonc
// app.json (trecho)
{
  "expo": {
    "scheme": "financeapp",              // deep link financeapp:// (usado por outras features/rotas)
    "plugins": [
      "expo-secure-store",
      ["@react-native-google-signin/google-signin", {
        "iosUrlScheme": "com.googleusercontent.apps.SEU_IOS_CLIENT_ID"
      }]
    ]
  }
}
```

### 2.2 Env vars

```ts
// src/env.ts (trecho — auth)
import { z } from "zod";

export const env = z.object({
  EXPO_PUBLIC_ENV:                z.enum(["development", "staging", "production", "test"]).default("development"),
  EXPO_PUBLIC_API_BASE_URL:       z.string().url(),
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: z.string().min(1),   // client ID "web" (audience do idToken; validado no backend)
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: z.string().min(1),
}).parse(process.env);
```

> Variáveis `EXPO_PUBLIC_*` são embutidas no bundle pelo Metro. **Não há segredo de auth no app** — o app só tem client IDs públicos do Google; o segredo que assina o JWT vive só no backend. O `webClientId` é o que o backend usa como *audience* ao verificar o `idToken`.

### 2.3 Google Sign-In — obter o `idToken`

```ts
// src/lib/auth/google.ts
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { env } from "@/env";

GoogleSignin.configure({
  webClientId: env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,   // gera o idToken com essa audience
  iosClientId: env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  offlineAccess: false,                                 // não precisamos do refresh do Google; usamos o nosso
});

/** Abre o fluxo nativo do Google e devolve o idToken (para trocar por JWT no backend). */
export async function signInWithGoogle(): Promise<string> {
  await GoogleSignin.hasPlayServices();
  const result = await GoogleSignin.signIn();
  const idToken = result.data?.idToken;
  if (!idToken) throw new Error("google_no_id_token");
  return idToken;
}

export async function signOutGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    /* ignora — sessão Google pode já estar encerrada */
  }
}

export { statusCodes as googleStatusCodes };
```

### 2.4 Token storage — `expo-secure-store`

```ts
// src/lib/auth/tokens.ts
import * as SecureStore from "expo-secure-store";

const ACCESS = "auth.accessToken";
const REFRESH = "auth.refreshToken";

export type Tokens = { accessToken: string; refreshToken: string };

export async function saveTokens({ accessToken, refreshToken }: Tokens): Promise<void> {
  await SecureStore.setItemAsync(ACCESS, accessToken);
  await SecureStore.setItemAsync(REFRESH, refreshToken);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS);
  await SecureStore.deleteItemAsync(REFRESH);
}
```

---

## 3. Sessão — trocar Google por JWT, refresh, decode

```ts
// src/lib/auth/session.ts
import { jwtDecode } from "jwt-decode";
import { router } from "expo-router";
import { env } from "@/env";
import { signInWithGoogle, signOutGoogle } from "./google";
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "./tokens";

type TokenResponse = { accessToken: string; refreshToken: string; expiresIn: number };
export type AccessPayload = { sub: string; email?: string; name?: string; exp: number };

const api = (path: string) => `${env.EXPO_PUBLIC_API_BASE_URL}${path}`;

/** Fluxo de login: Google → backend → grava JWT nosso. */
export async function loginWithGoogle(): Promise<void> {
  const idToken = await signInWithGoogle();
  const res = await fetch(api("/auth/google"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error("auth_google_exchange_failed");
  const tokens = (await res.json()) as TokenResponse;
  await saveTokens(tokens);
}

/** Troca o refresh token por um novo par (rotação). Retorna o novo access, ou null se falhar. */
async function refresh(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;
  const res = await fetch(api("/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return null;
  const tokens = (await res.json()) as TokenResponse;
  await saveTokens(tokens);
  return tokens.accessToken;
}

const decode = (t: string) => jwtDecode<AccessPayload>(t);
const isExpired = (p: AccessPayload) => p.exp * 1000 <= Date.now() + 30_000;   // margem de 30s

/** Access token válido (renova proativamente se expirado). Base do client de API. */
export async function getJwtToken(): Promise<string | undefined> {
  if (env.EXPO_PUBLIC_ENV === "test") return "JWT_TOKEN_TEST";
  const token = await getAccessToken();
  if (!token) return undefined;
  try {
    if (isExpired(decode(token))) {
      const refreshed = await refresh();
      return refreshed ?? undefined;
    }
    return token;
  } catch {
    return (await refresh()) ?? undefined;
  }
}

/** Claims do access token (sub, email, name). */
export async function getAccessTokenPayload(): Promise<AccessPayload | undefined> {
  if (env.EXPO_PUBLIC_ENV === "test") return undefined;
  const token = await getJwtToken();
  if (!token) return undefined;
  try {
    return decode(token);
  } catch {
    return undefined;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  if (env.EXPO_PUBLIC_ENV === "test") return true;
  return (await getJwtToken()) !== undefined;
}

/** Logout completo: revoga no backend, encerra o Google, limpa o secure store e volta pro login. */
export async function forceLogout(): Promise<void> {
  if (env.EXPO_PUBLIC_ENV === "test") return;
  const refreshToken = await getRefreshToken();
  try {
    if (refreshToken) {
      await fetch(api("/auth/logout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
    }
  } catch {
    /* logout é best-effort no servidor */
  } finally {
    await signOutGoogle();
    await clearTokens();
    router.replace("/(auth)/sign-in");
  }
}
```

```ts
// src/lib/auth/index.ts — barrel
export { loginWithGoogle, getJwtToken, getAccessTokenPayload, isAuthenticated, forceLogout } from "./session";
export type { AccessPayload } from "./session";
```

---

## 4. Tela de login

```tsx
// src/app/(auth)/sign-in.tsx
import { View } from "react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { loginWithGoogle } from "@/lib/auth";
import { useAuthActions } from "@/contexts/auth-context";

export default function SignInScreen() {
  const { t } = useTranslation("common");
  const { refresh } = useAuthActions();          // reavalia o contexto após login
  const [loading, setLoading] = useState(false);

  const onGoogle = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
      await refresh();                            // atualiza user → guard libera (tabs)
    } catch {
      /* mostre um toast de erro */
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 items-center justify-center gap-6 p-6">
      <Text className="text-2xl font-semibold">{t("auth.welcome")}</Text>
      <Button onPress={onGoogle} disabled={loading} accessibilityRole="button">
        {t("auth.signInWithGoogle")}
      </Button>
    </View>
  );
}
```

### 4.1 AuthContext

Estado de auth fica em Context (não Zustand). **Toda a app é envolvida por `AuthProvider`** (em `src/contexts/auth-context.tsx`).

```tsx
// src/contexts/auth-context.tsx
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getAccessTokenPayload, isAuthenticated } from "@/lib/auth";
import { type AuthUser, isTestEnv, TEST_AUTH } from "@/lib/auth/test-fixtures";

export type AuthState = {
  user: AuthUser | null;          // { id, email, name }
  isLoading: boolean;
  isAuthenticated: boolean;
};

const AuthContext = createContext<(AuthState & { refresh: () => Promise<void> }) | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() =>
    isTestEnv
      ? { user: TEST_AUTH.user, isLoading: false, isAuthenticated: true }
      : { user: null, isLoading: true, isAuthenticated: false },
  );

  const refresh = useCallback(async () => {
    if (isTestEnv) return;
    if (!(await isAuthenticated())) {
      setState({ user: null, isLoading: false, isAuthenticated: false });
      return;
    }
    const payload = await getAccessTokenPayload();      // claims do NOSSO access token
    if (!payload) {
      setState({ user: null, isLoading: false, isAuthenticated: false });
      return;
    }
    setState({
      user: { id: payload.sub, email: payload.email ?? "", name: payload.name ?? payload.email ?? "" },
      isLoading: false,
      isAuthenticated: true,
    });
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const value = useMemo(() => ({ ...state, refresh }), [state, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}

export function useAuthActions() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthActions deve ser usado dentro de <AuthProvider>");
  return { refresh: ctx.refresh };
}
```

O `user` é mínimo (`{ id, email, name }`), derivado do access token — sem chamada extra (`GET /me` só quando precisar de dados completos). **Este projeto não tem autorização por papel** — não há `permissions`/`usePermissions` no contexto; o acesso é gated só por autenticação (ver [`PERMISSIONS.md`](./PERMISSIONS.md)).

### 4.2 Test fixtures

```ts
// src/lib/auth/test-fixtures.ts
import { env } from "@/env";

export const isTestEnv = env.EXPO_PUBLIC_ENV === "test";

export type AuthUser = { id: string; email: string; name: string };

/** Sessão fake usada quando EXPO_PUBLIC_ENV === "test" (sem Google/backend real). */
export const TEST_AUTH: { token: string; user: AuthUser } = {
  token: "test-token",
  user: { id: "test-user", email: "test@b2breservas.com.br", name: "Test User" },
};
```

---

## 5. Integração com a API (client wrapper)

O fetch wrapper que o Kubb consome vive em **`src/api/client.ts`** (ver [`KUBB.md` §6](./KUBB.md#6-client-customizado-wrapper-de-fetch)). O essencial pra auth:

```ts
// src/api/client.ts (trecho)
import { forceLogout, getJwtToken } from "@/lib/auth";

const token = await getJwtToken();                     // renova proativamente se expirou
if (token) headers.set("Authorization", `Bearer ${token}`);   // JWT nosso, COM prefixo Bearer

// ...
if (res.status === 401 && env.EXPO_PUBLIC_ENV !== "test") {
  await forceLogout();                                 // refresh já foi tentado em getJwtToken
}
```

Pontos de auth:
- Token via `getJwtToken()` (access token do app; renova via `/auth/refresh` se expirado).
- Enviado **com `Bearer`** (`Authorization: Bearer <token>`).
- `401` → `forceLogout()` (volta pro grupo `(auth)`), exceto em test.
- `ApiError(status, statusText, data)` — payload de erro cru em `.data`.

> O refresh acontece em `getJwtToken()` (proativo, quando o token está a < 30s de expirar) e como fallback no decode. Não reimplemente refresh em cada chamada.

---

## 6. Guard de rota — `<Stack.Protected>`

O guard fica no **layout** via `<Stack.Protected guard={...}>` (não há `beforeLoad` por rota):

```tsx
// src/app/_layout.tsx (trecho — ver NAVIGATION.md para o layout completo)
import { Stack } from "expo-router";
import { useAuth } from "@/contexts/auth-context";

function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;                    // splash enquanto resolve a sessão

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
```

Sem sessão → só o grupo `(auth)` (login com Google). Com sessão → só o `(tabs)`. Não há autorização por papel — autenticado vê o app inteiro (ver [`PERMISSIONS.md`](./PERMISSIONS.md)). Detalhes em [`NAVIGATION.md`](./NAVIGATION.md).

---

## 7. Bootstrap completo

O bootstrap mobile mora no **root `_layout.tsx`** (Expo Router):

```tsx
// src/app/_layout.tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import * as Sentry from "@sentry/react-native";
import { queryClient } from "@/api/query-client";
import { AuthProvider } from "@/contexts/auth-context";
import { i18n } from "@/lib/i18n";
import { PostHogProvider } from "@/lib/observability/posthog";
import "@/lib/auth/google";            // GoogleSignin.configure() roda no import
import "@/global.css";

function RootLayout() {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <PostHogProvider>
          <AuthProvider>
            <RootNavigator />          {/* <Stack.Protected> — ver §6 / NAVIGATION.md */}
          </AuthProvider>
        </PostHogProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

export default Sentry.wrap(RootLayout);
```

> `GoogleSignin.configure()` roda no import de `@/lib/auth/google` (uma vez). Não há `configureAmplify()` — Amplify foi removido. `Sentry.wrap` embrulha o layout raiz (ver [`OBSERVABILITY.md`](./OBSERVABILITY.md)).

---

## 8. Logout

Botão de logout chama `forceLogout()`:

```tsx
import { Button } from "@/components/ui/button";
import { forceLogout } from "@/lib/auth";

<Button onPress={() => void forceLogout()} accessibilityRole="button">
  {t("common:auth.signOut")}
</Button>
```

`forceLogout()`:
1. `POST /auth/logout` (revoga o refresh token no backend) — best-effort.
2. `signOutGoogle()` (encerra a sessão do Google no device).
3. `clearTokens()` (limpa o `expo-secure-store`).
4. `router.replace("/(auth)/sign-in")`.

---

## 9. Test mode (E2E e dev sem backend/Google)

`EXPO_PUBLIC_ENV=test` faz bypass:

- `getJwtToken()` retorna `TEST_AUTH.token`
- `isAuthenticated()` sempre `true`
- `AuthProvider` injeta `TEST_AUTH.user`
- `forceLogout()` vira no-op

**Nunca habilite em produção.** A validação do `env.ts` garante só valores válidos.

---

## 10. Segurança

- **O app não valida assinatura de JWT** — só decodifica claims para UX. Autorização real é sempre no backend (403).
- **Não confie no `idToken` do Google no client** — quem o valida (audience, issuer, expiração) é o backend.
- **Tokens só em `expo-secure-store`.** Nunca logue tokens.
- **Refresh token é sensível** — o backend deve guardá-lo com hash e permitir revogação (logout).

---

## 11. Checklist de auth

- [ ] Sem `aws-amplify` / Cognito no projeto (removidos)
- [ ] `@react-native-google-signin/google-signin` com config plugin no `app.json` (dev client, não Expo Go)
- [ ] `GoogleSignin.configure({ webClientId, iosClientId })` roda uma vez (import em `lib/auth/google`)
- [ ] Env `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` / `_IOS_CLIENT_ID` / `EXPO_PUBLIC_API_BASE_URL` validadas no `env.ts`
- [ ] `loginWithGoogle()` = `signInWithGoogle()` → `POST /auth/google { idToken }` → grava `{ accessToken, refreshToken }`
- [ ] Access token curto + refresh via `POST /auth/refresh` (rotação); sem refresh → `forceLogout()`
- [ ] Tokens em `expo-secure-store` (não AsyncStorage/localStorage/useState)
- [ ] `getJwtToken()` renova proativamente e injeta `Authorization: Bearer <token>` no `client.ts`
- [ ] Access token decodificado (via `jwt-decode`) só para identidade (`sub`/`email`/`name`) — sem papéis/personas
- [ ] 401 do backend chama `forceLogout()`
- [ ] Guard de auth via `<Stack.Protected guard={isAuthenticated}>` (ver [`NAVIGATION.md`](./NAVIGATION.md))
- [ ] `forceLogout()` = `POST /auth/logout` + `signOutGoogle()` + `clearTokens()` + `router.replace("/(auth)/sign-in")`
- [ ] Test fixtures isoladas, ativadas só com `EXPO_PUBLIC_ENV=test`
