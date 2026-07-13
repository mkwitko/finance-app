# OBSERVABILITY.md — Observabilidade no app mobile

> Saber **o que** quebrou (Sentry), **quem** usou (PostHog), e **como o app se comportou** em produção. Duas camadas independentes; cada uma com seu papel. Regra-base: **sem `console.log`; eventos críticos capturados.**
>
> **Expo mudou.** Confira a doc do Expo SDK 57 (config plugins, EAS) e as libs `@sentry/react-native` / `posthog-react-native` — não confie em memória de versões antigas.

---

## 1. Stack e divisão de responsabilidades

| Ferramenta | Responsabilidade | Por quê escolhida |
|---|---|---|
| **`@sentry/react-native`** | Crashes nativos (iOS/Android) + erros JS, traces de performance, release tracking, source maps via EAS | Padrão de mercado; captura crash nativo que um SDK só-JS não vê; correlação com backend via traceId |
| **`posthog-react-native`** | Product analytics (eventos), feature flags, funis, session replay opcional | Tudo-em-um; feature flags com targeting; alternativa a Mixpanel + LaunchDarkly |

### 1.1 Session replay: Sentry **ou** PostHog?

Ambos oferecem replay mobile. **Decisão:** habilite replay no **Sentry** (sampling baixo; 100% em sessões com erro). PostHog replay **desligado por padrão**; ligamos via feature flag se surgir necessidade de produto. Evita duplo custo e dois lugares pra olhar.

---

## 2. Sentry — setup

### 2.1 Instalar

```bash
npx expo install @sentry/react-native
```

Adicione o config plugin no `app.json` (habilita upload de source maps e símbolos de debug no build EAS):

```jsonc
// app.json (trecho)
{
  "expo": {
    "plugins": [
      ["@sentry/react-native/expo", {
        "organization": "b2b-reservas",
        "project": "finance-app",
        "url": "https://sentry.io/"
      }]
    ]
  }
}
```

### 2.2 Init + `Sentry.wrap`

`Sentry.init` roda no topo do root `_layout.tsx`; o layout raiz é embrulhado com `Sentry.wrap`.

```tsx
// src/app/_layout.tsx (trecho — bootstrap completo em AUTH.md §7)
import * as Sentry from "@sentry/react-native";
import { isRunningInExpoGo } from "expo";
import { env } from "@/env";

Sentry.init({
  dsn: env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: env.EXPO_PUBLIC_ENV !== "development",
  environment: env.EXPO_PUBLIC_ENV,              // staging | production

  integrations: [
    // Instrumenta a navegação do Expo Router (tempo até tela, traces por rota):
    Sentry.reactNativeTracingIntegration(),
    Sentry.expoRouterIntegration({
      enableTimeToInitialDisplay: !isRunningInExpoGo(),   // não suportado no Expo Go
    }),
    // Replay mobile (mascara conteúdo sensível por padrão):
    Sentry.mobileReplayIntegration({
      maskAllText: false,
      maskAllImages: true,
      maskAllVectors: true,
    }),
  ],

  // Performance
  tracesSampleRate: env.EXPO_PUBLIC_ENV === "production" ? 0.1 : 1.0,

  // Replay
  replaysSessionSampleRate: 0.1,                 // 10% das sessões "normais"
  replaysOnErrorSampleRate: 1.0,                 // 100% quando dá erro

  beforeSend(event, hint) {
    // Não envia erros de rede esperados (4xx do nosso backend, exceto 401)
    const error = hint.originalException;
    if (error && typeof error === "object" && "status" in error) {
      const status = (error as { status: number }).status;
      if (status >= 400 && status < 500 && status !== 401) return null;
    }
    return event;
  },
});

function RootLayout() {
  return (/* providers + <RootNavigator /> — ver AUTH.md §7 */);
}

export default Sentry.wrap(RootLayout);
```

> `Sentry.wrap(RootLayout)` habilita o profiling do componente raiz e garante captura de erros de render desde o entry point. **Crashes nativos são capturados automaticamente** pelo SDK nativo — sem código adicional.

### 2.3 Identificar usuário após login

```ts
// src/lib/observability/identify.ts
import * as Sentry from "@sentry/react-native";

export function identifyUser(user: { id: string; email: string }) {
  Sentry.setUser({ id: user.id, email: user.email });
}

export function clearUserIdentity() {
  Sentry.setUser(null);
}
```

Chame `identifyUser` na volta do login (no `AuthProvider`, quando a sessão resolve); `clearUserIdentity` no `forceLogout`. Para o PostHog, use `identify`/`reset` (§3.4).

### 2.4 Capturar erro manualmente

```ts
import * as Sentry from "@sentry/react-native";

try {
  await complexOperation();
} catch (err) {
  Sentry.captureException(err, {
    tags: { feature: "users", action: "bulk-delete" },
    extra: { itemCount: items.length },
  });
  throw err;
}
```

### 2.5 Breadcrumbs custom

O SDK já captura navegação, toques e requests. Adicione breadcrumbs explícitos em eventos importantes:

```ts
Sentry.addBreadcrumb({
  category: "feature",
  message: "User tapped bulk delete",
  level: "info",
  data: { itemCount: 5 },
});
```

### 2.6 Source maps via EAS

Com o config plugin instalado, o **EAS Build faz o upload dos source maps e símbolos de debug automaticamente** ao final do build (injeção de debug ID + upload). Requisitos:

- `SENTRY_AUTH_TOKEN` disponível no build EAS (via **EAS Secrets** / env do perfil em `eas.json`). **Nunca** commite o token nem embuta em `EXPO_PUBLIC_*`.
- Em CI que rode o build fora do EAS, dá pra desligar o auto-upload (`disableAutoUpload`) e subir os source maps depois com `sentry-cli`.

Ver [`DEPLOYMENT.md`](./DEPLOYMENT.md) para onde os secrets moram.

---

## 3. PostHog — setup

### 3.1 Instalar

```bash
npx expo install posthog-react-native expo-file-system expo-application expo-device expo-localization
```

> `posthog-react-native` usa esses módulos Expo para persistência e propriedades de device.

### 3.2 Provider

```tsx
// src/lib/observability/posthog.tsx
import PostHog, { PostHogProvider as Provider } from "posthog-react-native";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { env } from "@/env";

export function PostHogProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => {
    if (!env.EXPO_PUBLIC_POSTHOG_KEY || env.EXPO_PUBLIC_ENV === "development") return null;
    return new PostHog(env.EXPO_PUBLIC_POSTHOG_KEY, {
      host: env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      captureNativeAppLifecycleEvents: true,      // app opened/backgrounded
      enableSessionReplay: false,                 // ligamos via flag se precisar
    });
  }, []);

  if (!client) return <>{children}</>;

  return (
    <Provider client={client} autocapture>
      {children}
    </Provider>
  );
}
```

`<PostHogProvider>` envolve a árvore no root `_layout.tsx` (ver [`AUTH.md` §7](./AUTH.md#7-bootstrap-completo)). Com `autocapture`, toques e navegação de tela são capturados automaticamente.

### 3.3 Eventos de produto

```tsx
import { usePostHog } from "posthog-react-native";

function UserForm() {
  const posthog = usePostHog();

  const handleCreated = (data: { role: string; bio?: string }) => {
    posthog.capture("user_created", {
      user_role: data.role,
      has_bio: !!data.bio,
    });
  };
  // ...
}
```

**Convenções de nome:** snake_case; verbo no passado (`user_created`, `booking_canceled`, `report_exported`); propriedades em snake_case.

### 3.4 Identify / reset

```tsx
const posthog = usePostHog();
posthog.identify(user.id, { email: user.email });   // após login
posthog.reset();                                     // no logout
```

### 3.5 Feature flags

```tsx
import { useFeatureFlag } from "posthog-react-native";

function Dashboard() {
  const showNew = useFeatureFlag("new-dashboard");
  return showNew ? <NewDashboard /> : <OldDashboard />;
}
```

Para forçar atualização das flags após uma ação (ex.: mudança de plano): `await posthog.reloadFeatureFlags()`.

### 3.6 PostHog + Sentry — correlação

Adicione o `distinct_id`/`session_id` do PostHog como tag no Sentry:

```ts
import * as Sentry from "@sentry/react-native";

Sentry.setTag("posthog_session_id", posthog.getSessionId());
Sentry.setTag("posthog_distinct_id", posthog.getDistinctId());
```

Olha o erro no Sentry → copia o `posthog_session_id` → busca no PostHog → vê eventos/replay da mesma sessão.

---

## 4. Correlação com backend (traceId)

Backend Fastify retorna `traceId` em todo erro 4xx/5xx. Adicione como tag no `client.ts` (ver [`KUBB.md`](./KUBB.md)):

```ts
import * as Sentry from "@sentry/react-native";

if (!res.ok) {
  const body = await res.json().catch(() => ({}));
  const traceId = body.error?.traceId;

  if (res.status >= 500) {
    Sentry.captureException(new ApiError(res.status, body.error?.code, body.error?.message, traceId), {
      tags: { trace_id: traceId },
      extra: { url: config.url, method: config.method },
    });
  }
  throw new ApiError(res.status, body.error?.code, body.error?.message, traceId);
}
```

No Sentry, filtre por tag `trace_id` para achar os logs correspondentes do backend.

---

## 5. Privacidade e LGPD

### 5.1 Mascaramento

- **Replay do Sentry** mascara imagens/vetores por padrão (`maskAllImages`/`maskAllVectors`). Para mascarar um texto específico (CPF, cartão), envolva com o componente de máscara do SDK (`<Sentry.Mask>`).
- **PostHog:** marque views sensíveis com a prop de não-captura do replay quando ele estiver ligado.

### 5.2 Consentimento

App B2B interno com login Google obrigatório → opt-in implícito (termos de uso). Se o app for ao público, adicione fluxo de consentimento antes de capturar (`posthog.optIn()`/`posthog.optOut()`).

### 5.3 IP / geolocalização

PostHog coleta IP por padrão. Para desligar (LGPD, se não precisar de geo): configure `property_blacklist` no init.

---

## 6. Em desenvolvimento

Ambos **desligados** por default quando `EXPO_PUBLIC_ENV=development` (guardas no init/provider). Para testar localmente, rode com `EXPO_PUBLIC_ENV=staging` e as chaves de dev.

> Crash/erro nativo **não aparece no Expo Go** — teste captura de crash num **dev client** ou build de desenvolvimento.

---

## 7. Pipeline (EAS)

| Var | Onde | Quando |
|---|---|---|
| `EXPO_PUBLIC_SENTRY_DSN` | EAS env (perfil) | Build (embutido no bundle) |
| `EXPO_PUBLIC_POSTHOG_KEY` | EAS env | Build |
| `EXPO_PUBLIC_POSTHOG_HOST` | EAS env | Build |
| `SENTRY_AUTH_TOKEN` | **EAS Secret** (não `EXPO_PUBLIC_*`) | Build-only, p/ upload de source maps |

O upload de source maps acontece dentro do **EAS Build** via config plugin. Ver [`DEPLOYMENT.md`](./DEPLOYMENT.md).

---

## 8. Dashboards mínimos

- **Sentry:** filtre por `environment:production`; alerta > 10 erros novos em 1h ou crash-free rate < 99%.
- **PostHog:** funil `app_opened` → `signed_in` → tela principal; drop-off > 30% é red flag. Dashboard de adoção por feature flag.

---

## 9. Quando NÃO usar

- **Tracking que viole LGPD/privacy** — valide com legal/security antes.
- **Telas com dados extremamente sensíveis** — desligue replay via máscara/segmento.
- **Nunca logue tokens, senhas, números de cartão.** Filtros `beforeSend` do Sentry + máscara de replay.

---

## 10. Checklist de observabilidade

- [ ] `Sentry.init` no topo do root `_layout.tsx`; `export default Sentry.wrap(RootLayout)`
- [ ] Config plugin `@sentry/react-native/expo` no `app.json` (source maps via EAS)
- [ ] `SENTRY_AUTH_TOKEN` como **EAS Secret**, nunca `EXPO_PUBLIC_*`
- [ ] Crashes nativos capturados (validado num dev client, não Expo Go)
- [ ] `expoRouterIntegration` instrumentando navegação
- [ ] `<PostHogProvider client autocapture>` envolvendo a árvore
- [ ] `identify`/`reset` (PostHog) e `setUser`/`setUser(null)` (Sentry) no login/logout
- [ ] `tracesSampleRate: 0.1` em produção; replay 10% / 100% com erro
- [ ] Eventos de produto críticos têm `posthog.capture`
- [ ] `traceId` do backend correlacionado em erros de API
- [ ] Sem `console.log`; erros críticos com `Sentry.captureException` + tags
- [ ] PII mascarada no replay
