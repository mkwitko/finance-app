---
name: expo-mobile-frontend
description: "Use this skill when working on an Expo / React Native mobile frontend — Expo SDK 57 + React Native 0.86 + React 19 + Expo Router (file-based, typed routes) + TypeScript strict, consuming a Fastify backend via Kubb-generated types and TanStack Query hooks. Module-based folder structure (components/users/, hooks/users/, schemas/users/), not vertical slice. Triggers: tasks that mention or imply adding/modifying/debugging screens (file-based via Expo Router under src/app/, groups like (tabs)/ and (auth)/, typed routes), components in src/components/<module>/, UI primitives in src/components/ui/, hooks in src/hooks/<module>/, schemas in src/schemas/<module>/, forms (React Hook Form + Zod with i18n keys as messages), TanStack Query usage with per-module endpoint constants (USERS.queryKeyRoot) for invalidation, uploads (presigned URL flow with expo-file-system / expo-image-picker), custom JWT auth with Google Sign-In (@react-native-google-signin/google-signin gets a Google idToken → backend issues the app's access/refresh JWT; tokens in expo-secure-store; Authorization: Bearer; forceLogout; no email/password self-service), NO role/persona authorization — access is gated only by authentication (authenticated-only; the backend restricts data by ownership), NativeWind v4 styling (Tailwind for RN, global.css + tailwind.config.js + babel jsxImportSource, dark mode via colorScheme), dates with date-fns + date-fns-tz + expo-localization (backend is UTC), react-i18next (pt-BR active), Sentry (@sentry/react-native) + PostHog (posthog-react-native), Jest + jest-expo + @testing-library/react-native + MSW testing, Maestro E2E, EAS Build/Update/Submit for delivery (no Docker). Activate when the user mentions Expo Router, Stack.Protected, useRouter/Link/Href, NativeWind, className on RN components, colorScheme, Kubb-generated hooks (useBookingsList, useListUsers), USERS.queryKeyRoot, expo-secure-store, Google Sign-In, JWT/Bearer token, useAuth, RHF Zod resolver, expo-image, Reanimated, EAS, or the finance-app mobile repo by name. Do NOT use this skill for backend (Node.js/Fastify) tasks — that's a separate backend skill; do NOT use it for the web React (Vite/TanStack Router) frontend."
---

# Expo Mobile Frontend — Padrão da empresa (React Native + Expo Router)

> **Skill entry point.** Carregue este arquivo antes de qualquer task no app mobile. Os `.md` em `./references/` são as referências detalhadas — vá direto para elas quando precisar de profundidade. Cada referência é independente e pode ser lida sob demanda.
>
> **Expo MUDOU.** Este projeto usa **Expo SDK 57**. Antes de escrever qualquer código que toque numa API do Expo, confira a doc versionada exata em https://docs.expo.dev/versions/v57.0.0/. Não confie em memória de versões antigas (New Architecture default, React Compiler, Reanimated 4, expo-router typed routes mudaram coisas).

---

## 1. Sobre o projeto

App mobile **Expo + React Native** consumindo a API Node+Fastify do backend. Type-safety **ponta-a-ponta**: schema do backend (Zod) → OpenAPI → Kubb gera types e hooks → TanStack Query consome. Mesma disciplina do frontend web da empresa, adaptada ao runtime nativo.

**Esta arquitetura serve como referência/padrão para todos os apps Expo da empresa.** Decisões aqui devem ser conservadoras, justificadas, e otimizadas para serem **copiadas e adaptadas** por outros times.

**Pilares não-negociáveis** (nessa ordem de prioridade):

1. **Type-safety ponta-a-ponta.** Zero `any` em código de produção. Tipos vêm do OpenAPI (Kubb), não são escritos à mão.
2. **Performance nativa percebida.** Startup rápido, 60fps nas interações, animações na UI thread (Reanimated worklets). Sem jank de lista, sem re-render desnecessário. JS bundle enxuto (lazy nas telas pesadas).
3. **Acessibilidade.** `accessibilityLabel`/`accessibilityRole` em elementos interativos; alvos de toque ≥ 44pt; suporte a fonte grande do sistema.
4. **Observabilidade.** Sentry captura erros + traces nativos, PostHog captura uso. Sem caixa-preta em produção.
5. **i18n-ready.** Nenhuma string hardcoded. App começa em pt-BR mas a arquitetura suporta novos idiomas sem refatoração (react-i18next + expo-localization).
6. **Testabilidade.** Feature crítica tem teste com @testing-library/react-native + MSW. Fluxos críticos têm Maestro.
7. **DX e padronização.** Qualquer dev do time entende qualquer tela em < 5 min.

---

## 2. Stack (não substitua sem discussão)

| Camada | Escolha | Por quê (curto) |
|---|---|---|
| Framework | **Expo SDK 57** (managed) | Toolchain nativo sem ejetar; OTA via EAS Update; New Architecture default |
| Runtime | React Native 0.86 + React 19 | Hermes; React Compiler ligado (`experiments.reactCompiler`) |
| Linguagem | TypeScript 5+ strict | Type safety |
| Bundler | **Metro** | Bundler oficial RN (não Vite) |
| Router | **Expo Router** (file-based) | Rotas = pastas em `src/app/`; typed routes (`experiments.typedRoutes`); deep-link nativo |
| Data fetching | TanStack Query 5 | Padrão de facto para server state em React (funciona igual em RN) |
| API client | **Kubb** | Gera types + TanStack Query hooks do OpenAPI do backend |
| UI/estilo | **NativeWind v4** (Tailwind p/ RN) | `className` em componentes RN; parity mental com o front web; dark mode via `colorScheme` |
| Primitivos UI | `src/components/ui/` (RN + NativeWind) + `@expo/ui` / `expo-glass-effect` quando nativo agregar | shadcn é web-only; recriamos primitivos nativos com controle total |
| Auth | **JWT próprio + Google Sign-In** | Login Google (`@react-native-google-signin`) → backend Fastify emite access/refresh JWT; tokens em `expo-secure-store`; `Authorization: Bearer` |
| Validação | Zod | Forms, env, boundary — mesma linguagem do backend |
| Forms | React Hook Form + Zod resolver | Mensagens via i18n keys |
| UI state | Zustand (se necessário) | Quando TanStack Query não cobre |
| Datas/timezone | date-fns + date-fns-tz + expo-localization | UTC do backend → fuso do device |
| i18n | react-i18next + expo-localization | pt-BR ativo; estrutura para novos idiomas |
| Erros | Sentry (`@sentry/react-native`) | Crashes nativos + JS, source maps, releases |
| Product analytics | PostHog (`posthog-react-native`) | Eventos, feature flags, funis |
| Imagens | `expo-image` | Cache, blurhash, `contentFit`, sem `<Image>` cru do RN |
| Animação/gesto | Reanimated 4 + Gesture Handler | Animação na UI thread (worklets) |
| Testes unit/integr | Jest + jest-expo + @testing-library/react-native + MSW | Runner oficial Expo |
| Testes e2e | **Maestro** | E2E mobile recomendado pelo Expo (não Playwright/Detox) |
| Lint/Format | `expo lint` (ESLint flat config Expo) | Padrão do template Expo 57 |
| Package manager | pnpm | Mesmo do backend |
| Build/Deploy | **EAS Build + EAS Update + EAS Submit** | Nativo Expo; OTA sem app store; **sem Docker** |

> Por que Expo Router (não React Navigation cru)? NativeWind (não StyleSheet puro/Tamagui)? JWT próprio + Google (não Cognito/Amplify)? Maestro (não Detox)? Veja [`DECISIONS.md`](./references/DECISIONS.md).

---

## 3. Arquitetura — por módulo, não vertical slice

```
Screen (rota Expo Router em src/app/)
    ↓
[Screen component]  ── orquestra: chama hooks, monta layout, conecta forms
    ↓
[Components do módulo]  ── src/components/<modulo>/* (kebab-case)
    ↓
[Hooks gerados pelo Kubb]  ── useListUsers, useCreateBooking, etc. (nome = operationId)
    ↓
[UI primitives]  ── src/components/ui/* (RN + NativeWind, kebab-case)
```

**Princípio:** **organização por tipo + módulo**, não por feature isolada. `components/users/` sempre; `hooks/<módulo>/` e `schemas/<módulo>/` sob demanda. Detalhes em [`ARCHITECTURE.md`](./references/ARCHITECTURE.md).

**Diferenças-chave vs. o frontend web (mesma empresa):**
- **Sem DOM.** `View`/`Text`/`Pressable`/`ScrollView`/`FlatList`, não `div`/`span`/`button`. Sem CSS cascata — NativeWind resolve `className` em build.
- **Router é Expo Router, não TanStack Router.** Guard de auth via `<Stack.Protected guard={...}>` no layout, não `beforeLoad`.
- **Navegação declarativa.** `<Link href="/users/[id]">`, `router.push()`, `useLocalSearchParams()`. Rotas tipadas (`typedRoutes`).
- **Auth mobile.** JWT próprio + Google Sign-In (sem Cognito/Amplify). Login Google devolve um `idToken` → backend troca por access/refresh JWT nossos. Tokens em `expo-secure-store` (não CookieStorage); enviados como `Authorization: Bearer`.
- **Sem service layer próprio / sem state manager global por padrão** (igual ao web): Kubb gera hooks; TanStack Query = server state; Zustand só p/ UI state compartilhado.

Detalhes completos: [`ARCHITECTURE.md`](./references/ARCHITECTURE.md)

---

## 4. Estrutura de pastas

```
src/
├── app/                        # EXPO ROUTER — file-based (rotas = arquivos)
│   ├── _layout.tsx             # root layout: providers (Query, Auth, i18n) + <Stack> + guards
│   ├── index.tsx               # / (redireciona conforme auth)
│   ├── (auth)/                 # grupo não-autenticado (sign-in com Google)
│   │   ├── _layout.tsx
│   │   └── sign-in.tsx
│   ├── (tabs)/                 # grupo autenticado com tab bar
│   │   ├── _layout.tsx         # <Tabs>
│   │   ├── index.tsx
│   │   └── users/
│   │       ├── index.tsx       # /users
│   │       └── [id].tsx        # /users/:id  (useLocalSearchParams)
│   └── +not-found.tsx
│
├── api/                        # API CLIENT (Kubb) — fora de lib/
│   ├── client.ts               # fetch wrapper (injeta Bearer JWT via getJwtToken, forceLogout no 401)
│   ├── query-client.ts         # QueryClient singleton
│   ├── modules/                # constantes por módulo (USERS.queryKeyRoot, endpoints)
│   └── generated/              # GERADO pelo Kubb (gitignored)
│       ├── hooks/<tag>Hooks/
│       ├── types/
│       └── index.ts
│
├── components/                 # por módulo (kebab-case files, export PascalCase)
│   ├── ui/                     # primitivos RN + NativeWind (button.tsx, text.tsx, input.tsx, card.tsx)
│   ├── layout/                 # screen-container.tsx, app-header.tsx
│   ├── shared/                 # auth-gate.tsx, empty-state.tsx, error-state.tsx
│   ├── users/                  # users-list.tsx, user-form.tsx, user-detail.tsx
│   └── bookings/               # booking-card.tsx
│
├── contexts/
│   └── auth-context.tsx        # AuthProvider, useAuth, useAuthActions
│
├── hooks/                      # só common/ hoje; hooks/<módulo>/ sob demanda
│   └── common/                 # use-debounce.ts, use-format.ts, use-color-scheme.ts
│
├── schemas/                    # schemas/<módulo>/ quando um módulo ganha forms Zod
│
├── lib/                        # INFRA — não-módulo
│   ├── auth/
│   │   ├── google.ts           # GoogleSignin.configure() + signInWithGoogle() (idToken)
│   │   ├── tokens.ts           # access/refresh em expo-secure-store
│   │   ├── session.ts          # loginWithGoogle, getJwtToken, refresh, getAccessTokenPayload, forceLogout
│   │   ├── index.ts            # barrel (getJwtToken, isAuthenticated, forceLogout, ...)
│   │   └── test-fixtures.ts
│   │   # sem lib/permissions/ — projeto não tem autorização por papel (ver PERMISSIONS.md)
│   ├── datetime/               # format.ts, timezone.ts (device tz via expo-localization)
│   ├── i18n/                   # init i18next + expo-localization + types.d.ts
│   ├── observability/          # sentry, posthog
│   └── utils.ts                # cn() (clsx + tailwind-merge) etc.
│
├── stores/                     # Zustand (UI state compartilhado)
│
└── constants/                  # theme tokens, HUB/env-derived
│
env.ts                          # validação Zod das env (expo-constants extra / EAS env)

global.css                      # NativeWind: @tailwind base/components/utilities
tailwind.config.js              # preset: nativewind/preset; content: ./src/**/*.{ts,tsx}
babel.config.js                 # babel-preset-expo { jsxImportSource: 'nativewind' } + 'nativewind/babel'
metro.config.js                 # withNativeWind(config, { input: './global.css' })
app.json                        # Expo config (scheme, plugins, experiments.typedRoutes/reactCompiler)
kubb.config.ts                  # config Kubb (lê fixture local api.json; ver KUBB.md)
api.json                        # OpenAPI fixture commitada (input do Kubb)
eas.json                        # perfis de build/update/submit (ver DEPLOYMENT.md)

test/
├── mocks/                      # MSW (handlers.ts, server.ts)
└── setup.ts                    # jest setup (i18n + MSW server)

.maestro/                       # fluxos E2E Maestro (.yaml)

assets/                         # imagens, fontes, ícones
```

**O client de API mora em `src/api/`** (não `src/lib/api/`) — coração type-safe do projeto.
**Rotas moram em `src/app/`** (Expo Router `main: "expo-router/entry"`), não `src/routes/`.
**Sem `Dockerfile` / `nginx.conf`** — entrega é EAS ([`DEPLOYMENT.md`](./references/DEPLOYMENT.md)).

---

## 5. Como Claude Code deve trabalhar

### Antes de codar

1. **Confira a doc do Expo SDK 57.** APIs mudam entre versões — https://docs.expo.dev/versions/v57.0.0/.
2. **Identifique a camada.** Rota (`src/app/`)? Componente de feature? Hook? UI primitive? Cada uma tem regras diferentes.
3. **Releia o `.md` relevante.** API? [`KUBB.md`](./references/KUBB.md). Form? [`FORMS.md`](./references/FORMS.md). Estilo? [`STYLING.md`](./references/STYLING.md). Navegação? [`NAVIGATION.md`](./references/NAVIGATION.md).
4. **Procure padrão existente.** Se `users` existe, copie a estrutura pra `bookings`. Consistência > criatividade.

### Ao escrever código

- **TypeScript strict.** Sem `any`. Sem `as` casual.
- **Tipos vêm do Kubb.** Nunca digite o shape de uma resposta de API à mão.
- **`useQuery`/`useMutation` vêm de hooks gerados** (`useListUsers`, `useGetRfp` — nome = `operationId`), não `useQuery` manual.
- **Invalidação via constantes por módulo:** `queryClient.invalidateQueries({ queryKey: USERS.queryKeyRoot })` — nunca string crua.
- **Primitivos RN, nunca DOM.** `View`/`Text`/`Pressable`/`FlatList`; `expo-image` no lugar de `<Image>`. Nada de `div`/`onClick`.
- **Estilo via NativeWind `className`.** `cn()` p/ merge condicional. Sem `StyleSheet.create` salvo caso justificado (perf/animação). Dark mode via classes `dark:` + `useColorScheme` ([`STYLING.md`](./references/STYLING.md)).
- **Filenames em kebab-case.** `user-form.tsx`, `use-cancel-booking.ts`. Export PascalCase (`UserForm`).
- **Rotas em `src/app/`.** Grupos `(auth)`/`(tabs)`; params dinâmicos `[id].tsx` lidos via `useLocalSearchParams()`. Navegação com `<Link href>` / `router.push()`. Guard de auth com `<Stack.Protected guard={isLoggedIn}>` no `_layout` ([`NAVIGATION.md`](./references/NAVIGATION.md)).
- **Forms via React Hook Form + Zod resolver.** Mensagens = chaves i18n (`namespace:caminho`), renderizadas em `<Text>` de erro.
- **Toda string visível usa `t("chave")`.** Sem strings hardcoded ([`I18N.md`](./references/I18N.md)).
- **Datas/moedas/números via `useFormat()`.** Sem `.toLocaleDateString()` direto. Backend é UTC (ISO termina em `Z`) → exibir no fuso do device; enviar → `Date.toISOString()` ([`DATES.md`](./references/DATES.md)).
- **Auth via JWT próprio + Google Sign-In.** `useAuth()` expõe `user`, `isLoading`, `isAuthenticated`. Login: `@react-native-google-signin` → `idToken` → `POST /auth/google` → access/refresh JWT nossos em `expo-secure-store`. Chamadas usam `Authorization: Bearer <accessToken>` (via `getJwtToken()`, que renova pelo `/auth/refresh`). Logout → `forceLogout()`. Sem e-mail/senha, sem Cognito/Amplify ([`AUTH.md`](./references/AUTH.md)).
- **Sem autorização por papel.** Este projeto não tem personas/roles, `useCan`, `<Can>` nem catálogo de permissões. O acesso é gated só por autenticação (guard `<Stack.Protected>`); o backend restringe dados por posse ([`PERMISSIONS.md`](./references/PERMISSIONS.md)).
- **Uploads seguem o fluxo de presigned URL do backend** (`expo-image-picker`/`expo-document-picker` → PUT na URL) ([`UPLOADS.md`](./references/UPLOADS.md)).
- **Listas longas usam `FlatList`/`FlashList`** com `keyExtractor` e itens memoizados — nunca `.map()` dentro de `ScrollView`.
- **Animação na UI thread** (Reanimated worklets), não `Animated` do RN core em hot paths.
- **Sem `console.log` em PR.** Use Sentry/PostHog ([`OBSERVABILITY.md`](./references/OBSERVABILITY.md)).
- **Acessibilidade não é opcional.** `accessibilityRole`/`accessibilityLabel`, alvos ≥ 44pt.
- **Cada feature crítica tem teste** com @testing-library/react-native + MSW.

### Antes de abrir PR

Checklist em [`CODING_STANDARDS.md`](./references/CODING_STANDARDS.md), seção "Definition of Done".

---

## 6. Comandos essenciais

```bash
# Dev
pnpm start                   # expo start (Metro; QR / dev client)
pnpm ios                     # expo start --ios (simulador)
pnpm android                 # expo start --android (emulador)
pnpm web                     # expo start --web (react-native-web)

# Geração de API client (Kubb)
pnpm api:generate            # kubb generate — lê a fixture local api.json
pnpm api:watch               # kubb generate --watch

# Qualidade
pnpm lint                    # expo lint
pnpm typecheck               # tsc --noEmit

# Testes
pnpm test                    # jest (jest-expo)
pnpm test:e2e                # maestro test .maestro/

# Build & entrega (EAS — requer login)
eas build --profile preview --platform ios
eas update --branch preview        # OTA (JS-only)
eas submit --platform ios          # envia pra loja
```

> Para apontar o Kubb ao backend real, troque `input.path` em `kubb.config.ts` por uma URL do `openapi.json`. Hoje ele lê a fixture commitada `api.json`.
> Detalhes de build/OTA/submit em [`DEPLOYMENT.md`](./references/DEPLOYMENT.md). **Não há Docker.**

---

## 7. Quando estiver em dúvida

1. Confira a doc versionada do Expo SDK 57.
2. Olhe um módulo existente como referência (`components/users/` é o template canônico).
3. Releia o `.md` da área.
4. Pergunte: "isso preserva os 7 pilares da seção 1?"
5. Se ainda em dúvida, prefira **menos código** + **mais type-safety**, nessa ordem.
6. **Não invente padrões novos sozinho.** Arquitetura corporativa; consistência entre projetos importa mais que otimização local.
