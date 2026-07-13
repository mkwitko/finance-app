# ARCHITECTURE.md — Camadas, módulos, padrões

> Como o código do app é organizado e por quê. **Por módulo, não vertical slice** — `components/users/`, `hooks/users/`, `schemas/users/`. Cada tipo de coisa fica num lugar, agrupada por módulo de negócio.
>
> **Expo mudou.** Confira a doc do Expo SDK 57 (Expo Router, New Architecture, typed routes) em https://docs.expo.dev/versions/v57.0.0/ antes de mexer em rota/layout.

---

## 1. Princípios

1. **File-based routing (Expo Router).** A árvore de `src/app/` espelha as rotas. Adicionar tela = criar arquivo.
2. **Organização por módulo dentro de cada tipo.** `components/users/`, `hooks/users/`, `schemas/users/`. Quem busca "todos os componentes" tem um lugar. Quem busca "todos os hooks de users" também tem.
3. **Separação clara entre server state e UI state.** TanStack Query cuida do primeiro; React state ou Zustand do segundo.
4. **API client é gerado, não escrito.** Kubb lê o OpenAPI e gera tudo (ver [`KUBB.md`](./KUBB.md)). **Sem service layer próprio.**
5. **Composição de primitivos.** Primitivos RN + NativeWind em `components/ui/`; módulos compõem por cima. Sem DOM.
6. **Filenames em kebab-case.** `user-form.tsx`, `use-cancel-booking.ts`. Componente exportado continua PascalCase (`UserForm`).

---

## 2. Estrutura de pastas

```
src/
├── app/                        # EXPO ROUTER — file-based (rotas = arquivos)
│   ├── _layout.tsx             # root layout: providers (Query, Auth, i18n, PostHog) + <Stack> + Stack.Protected
│   ├── index.tsx               # / (redireciona conforme auth)
│   ├── +not-found.tsx
│   ├── (auth)/                 # grupo não-autenticado
│   │   ├── _layout.tsx
│   │   └── sign-in.tsx         # botão → Google Sign-In (ver AUTH.md)
│   └── (tabs)/                 # grupo autenticado com tab bar
│       ├── _layout.tsx         # <Tabs>
│       ├── index.tsx           # /
│       └── users/              # módulo (rotas)
│           ├── index.tsx       # /users (lista)
│           ├── new.tsx         # /users/new
│           └── [id].tsx        # /users/:id  (useLocalSearchParams)
│   # o guard de auth é <Stack.Protected guard={isAuthenticated}> no root _layout (ver NAVIGATION.md)
│
├── api/                        # API CLIENT (Kubb) — fora de lib/
│   ├── client.ts               # fetch wrapper (injeta Bearer JWT via getJwtToken; forceLogout no 401)
│   ├── query-client.ts         # QueryClient singleton
│   ├── modules/                # constantes por módulo (USERS.queryKeyRoot, endpoints)
│   │   ├── index.ts            # barrel
│   │   └── users.ts
│   └── generated/              # GERADO pelo Kubb (gitignored)
│       ├── hooks/<tag>Hooks/   # ex.: usersHooks/, bookingsHooks/
│       ├── types/
│       └── index.ts
│
├── components/                 # COMPONENTES — por módulo (kebab-case files, export PascalCase)
│   ├── ui/                     # primitivos RN + NativeWind (button.tsx, text.tsx, input.tsx, card.tsx)
│   ├── layout/                 # screen-container.tsx, app-header.tsx
│   ├── shared/                 # compartilhados entre módulos (não-primitivos)
│   │   ├── empty-state.tsx
│   │   ├── error-state.tsx
│   │   └── remote-image.tsx    # wrapper de expo-image
│   ├── users/                  # módulo users
│   │   ├── user-form.tsx
│   │   ├── users-list.tsx
│   │   ├── user-detail.tsx
│   │   └── user-avatar.tsx
│   └── bookings/               # módulo bookings
│       ├── booking-card.tsx
│       ├── bookings-list.tsx
│       └── cancel-booking-dialog.tsx
│
├── contexts/                   # React contexts
│   └── auth-context.tsx        # AuthProvider, useAuth (sem permissões)
│
├── hooks/                      # HOOKS — só common/ hoje; hooks/<módulo>/ quando precisar
│   └── common/                 # use-debounce.ts, use-format.ts, use-color-scheme.ts
│
│   # schemas/<módulo>/ (Zod) é criado quando um módulo ganha forms — ainda não existe
│
├── lib/                        # INFRA — não-módulo
│   ├── auth/
│   │   ├── google.ts           # GoogleSignin.configure() + signInWithGoogle() (idToken)
│   │   ├── tokens.ts           # access/refresh em expo-secure-store
│   │   ├── session.ts          # loginWithGoogle, getJwtToken, refresh, getAccessTokenPayload, forceLogout
│   │   ├── index.ts            # barrel (getJwtToken, isAuthenticated, forceLogout, ...)
│   │   └── test-fixtures.ts    # fixtures pra EXPO_PUBLIC_ENV=test
│   │   # sem lib/permissions/ — projeto não tem autorização por papel (ver PERMISSIONS.md)
│   ├── datetime/               # format.ts, timezone.ts (device tz via expo-localization)
│   ├── i18n/                   # init i18next + expo-localization + types.d.ts
│   ├── observability/          # sentry.ts, posthog.tsx
│   └── utils.ts                # cn() (clsx + tailwind-merge) etc.
│
├── stores/                     # Zustand stores (UI state compartilhado)
│   └── ui-store.ts
│
└── constants/                  # theme tokens, env-derived
│
env.ts                          # validação Zod das env (EXPO_PUBLIC_* / EAS env)
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
**Sem `Dockerfile` / `nginx.conf`** — entrega é EAS ([`DEPLOYMENT.md`](./DEPLOYMENT.md)).

---

## 3. Por que organização por módulo (não vertical slice)

| Vertical slice (`features/users/`) | Por módulo (escolha) |
|---|---|
| Tudo de uma feature num lugar | Cada tipo de coisa num lugar |
| Mover/remover feature inteira é fácil | Encontrar "todos os componentes" é fácil |
| Acoplamento intra-feature implícito | Acoplamento entre tipos é explícito (import claro) |
| Onboarding precisa explicar onde tudo mora | Padrão familiar (Rails, Django) |

A escolha foi por módulo porque:
- Devs entram/saem do projeto e precisam achar `components/` direto.
- Refactor cross-módulo (mover `UserAvatar` pra `shared/`) é mais natural.
- Vertical slice tende a virar "mini-app" com inconsistência interna.

**Regras:**
- Componente do módulo X **pode** importar de `components/shared/`, `components/ui/`, `lib/`, `hooks/common/`, `api/`.
- Componente do módulo X **não deve** importar de `components/<outro-módulo>/`. Se precisar, candidato a `components/shared/`.

---

## 4. Roteamento — Expo Router (file-based)

> Guia completo de navegação (grupos, tabs, params, deep link, guard) em [`NAVIGATION.md`](./NAVIGATION.md). Aqui, só o essencial de arquitetura.

### 4.1 Convenções de arquivo

Pasta `src/app/`:

```
app/
├── _layout.tsx                 # root layout (providers + <Stack> + <Stack.Protected>)
├── index.tsx                   # /
├── (auth)/                     # grupo (não muda a URL; agrupa telas)
│   ├── _layout.tsx
│   └── sign-in.tsx             # /sign-in
└── (tabs)/
    ├── _layout.tsx             # <Tabs>
    └── users/
        ├── index.tsx           # /users
        ├── new.tsx             # /users/new
        └── [id].tsx            # /users/:id
```

> **Grupos `(auth)`/`(tabs)`** organizam telas sem virar segmento de URL. **Params dinâmicos** usam `[id].tsx`, lidos via `useLocalSearchParams()`. **Rotas tipadas** com `experiments.typedRoutes` no `app.json` — `<Link href>` e `router.push()` são checados pelo compilador.

### 4.2 Guard de auth — `<Stack.Protected>`, não `beforeLoad`

No web era `beforeLoad: requireAuth` por rota (TanStack Router). No mobile, o guard é declarativo no **root layout**:

```tsx
// src/app/_layout.tsx (trecho — layout completo em NAVIGATION.md)
import { Stack } from "expo-router";
import { useAuth } from "@/contexts/auth-context";

function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;

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

**Sem sessão** → só o grupo `(auth)` monta (login com Google). **Com sessão** → só o `(tabs)`. Sem e-mail/senha. Detalhes em [`AUTH.md`](./AUTH.md) e [`NAVIGATION.md`](./NAVIGATION.md).

### 4.3 Anatomia de uma tela

```tsx
// src/app/(tabs)/users/[id].tsx
import { useLocalSearchParams } from "expo-router";
import { useGetUser } from "@/api/generated/hooks/usersHooks/useGetUser";
import { UserDetail } from "@/components/users/user-detail";
import { ScreenContainer } from "@/components/layout/screen-container";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";

export default function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: user, isLoading, isError, error, refetch } = useGetUser(id);

  return (
    <ScreenContainer>
      {isLoading && <Skeleton className="h-96" />}
      {isError && <ErrorState error={error} onRetry={refetch} />}
      {user && <UserDetail user={user} />}
    </ScreenContainer>
  );
}
```

> Telas usam **`export default`** (exigência do Expo Router). O nome do hook gerado é o `operationId` (`useGetUser`), não `useUsersGetUser`. Params dinâmicos vêm de `useLocalSearchParams()` — tipado com `experiments.typedRoutes`.

### 4.4 Type-safety de params e search

```tsx
// params de rota + query params são strings; parseie/valide com Zod se precisar de tipo forte
import { useLocalSearchParams } from "expo-router";
import { z } from "zod";

const paramsSchema = z.object({
  id: z.string(),
  tab: z.enum(["profile", "bookings"]).default("profile"),
});

function UserDetailScreen() {
  const raw = useLocalSearchParams();
  const { id, tab } = paramsSchema.parse(raw);
  // ...
}
```

Com `experiments.typedRoutes`, `<Link href="/users/[id]">` e `router.push({ pathname: "/users/[id]", params: { id } })` são checados pelo compilador — typo em rota não builda.

### 4.5 Root layout — providers + navigator

O shell da app (providers globais) vive no root `_layout.tsx`; cada grupo tem seu próprio `_layout` (`<Tabs>` em `(tabs)`, `<Stack>` em `(auth)`):

```tsx
// src/app/_layout.tsx (esqueleto — ver AUTH.md §7 e OBSERVABILITY.md para o completo)
import { QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import * as Sentry from "@sentry/react-native";
import { queryClient } from "@/api/query-client";
import { AuthProvider } from "@/contexts/auth-context";
import { i18n } from "@/lib/i18n";
import { PostHogProvider } from "@/lib/observability/posthog";
import "@/lib/auth/google";        // GoogleSignin.configure() roda no import
import "@/global.css";

function RootLayout() {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <PostHogProvider>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </PostHogProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}

export default Sentry.wrap(RootLayout);
```

> O `AuthProvider` envolve o navigator pra que `<Stack.Protected>` leia `isAuthenticated`. `Sentry.wrap` embrulha o layout raiz (ver [`OBSERVABILITY.md`](./OBSERVABILITY.md)).

---

## 5. Anatomia de um módulo

Exemplo: gerenciar usuários.

```
src/
├── components/users/
│   ├── users-list.tsx
│   ├── user-detail.tsx
│   ├── user-form.tsx
│   ├── cancel-user-dialog.tsx
│   └── user-avatar.tsx
├── hooks/users/
│   ├── use-users-filters.ts
│   └── use-delete-user.ts
├── schemas/users/
│   ├── create-user.schema.ts
│   └── update-user.schema.ts
└── app/(tabs)/users/
    ├── index.tsx
    ├── new.tsx
    └── [id].tsx
```

> `hooks/users/` e `schemas/users/` são criados só quando o módulo precisa deles (hoje nenhum módulo tem — `hooks/` só tem `common/`). **`components/users/` é o template canônico** — copie a estrutura ao criar `bookings`.

**Regras:**
- Componentes de módulo **podem** importar de `@/components/ui/*`, `@/components/shared/*`, `@/lib/*`, `@/api/*`, `@/hooks/common/*`, e hooks gerados pelo Kubb.
- Componentes de módulo **não devem** ser importados por outros módulos. Se acontecer, candidato a `components/shared/`.
- Schemas Zod ficam **no módulo**, não compartilhados — criar vs editar têm regras diferentes.

### 5.1 Componente típico (RN)

```tsx
// src/components/users/users-list.tsx
import { FlatList } from "react-native";
import { useTranslation } from "react-i18next";
import { Link } from "expo-router";
import { useListUsers } from "@/api/generated/hooks/usersHooks/useListUsers";
import { UserRow } from "./user-row";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";

type Props = {
  filters: { search?: string; page: number };
};

export function UsersList({ filters }: Props) {
  const { t } = useTranslation("users");
  const { data, isLoading } = useListUsers({
    search: filters.search,
    page: filters.page,
    pageSize: 20,
  });

  if (isLoading) return <ListSkeleton rows={10} />;
  if (!data || data.items.length === 0) return <EmptyState message={t("list.empty")} />;

  return (
    <FlatList
      data={data.items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <UserRow user={item} />}
      ListHeaderComponent={
        <Link href="/users/new" asChild>
          <Button>{t("list.actions.new")}</Button>
        </Link>
      }
    />
  );
}
```

**Princípios:**
- Primitivos RN (`FlatList`, `View`, `Text`), **nunca DOM** (`div`, `onClick`). Listas longas com `FlatList`/`FlashList` + `keyExtractor` + itens memoizados — nunca `.map()` dentro de `ScrollView`.
- Filename em kebab-case (`users-list.tsx`); export em PascalCase (`UsersList`).
- Recebe **props mínimas** (geralmente apenas filtros parseados).
- Chama hook gerado pelo Kubb (`useListUsers` — nome = `operationId`) — não cria `queryFn` à mão.
- Texto visível via `t()` — nada hardcoded ([`I18N.md`](./I18N.md)).
- Sem `useState` para dados de servidor (TanStack Query é a fonte da verdade).
- Estilo via NativeWind `className` ([`STYLING.md`](./STYLING.md)).

---

## 6. Composição de tela

Tela = rota + composição de componentes do módulo. **Mantenha-a fina.**

```tsx
// src/app/(tabs)/users/index.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { UsersList } from "@/components/users/users-list";
import { ScreenContainer } from "@/components/layout/screen-container";
import { AppHeader } from "@/components/layout/app-header";

export default function UsersScreen() {
  const { t } = useTranslation("users");
  const [search, setSearch] = useState<string | undefined>(undefined);

  return (
    <ScreenContainer>
      <AppHeader title={t("list.title")} onSearch={setSearch} />
      <UsersList filters={{ search, page: 1 }} />
    </ScreenContainer>
  );
}
```

---

## 7. Hooks customizados

### 7.1 Hooks gerados pelo Kubb — não escreva à mão

```tsx
import { useCreateUser } from "@/api/generated/hooks/usersHooks/useCreateUser";
import { router } from "expo-router";

const { mutate: createUser, isPending } = useCreateUser({
  onSuccess: () => {
    Toast.show({ type: "success", text1: t("feedback.created") });
    router.replace("/users");
  },
});
```

### 7.2 Hooks customizados — quando criar

Crie hook custom quando:
- **Compõe** múltiplos hooks gerados.
- Adiciona **side effects** (analytics, toast, invalidação composta).
- Encapsula **lógica de UI complexa** reutilizada.

```ts
// src/hooks/users/use-delete-user.ts
import { useDeleteUser as useDeleteUserGenerated } from "@/api/generated/hooks/usersHooks/useDeleteUser";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { USERS } from "@/api/modules";

export function useDeleteUser() {
  const { t } = useTranslation("users");
  const queryClient = useQueryClient();

  return useDeleteUserGenerated({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS.queryKeyRoot });
      Toast.show({ type: "success", text1: t("feedback.deleted") });
      router.replace("/users");
    },
    onError: () => {
      Toast.show({ type: "error", text1: t("feedback.deleteError") });
    },
  });
}
```

> `USERS.queryKeyRoot` em vez de string crua — ver [`KUBB.md` §8](./KUBB.md#8-querykey-conventions).

### 7.3 Não escreva wrappers inúteis

```ts
// ❌ wrapper que só repassa
export function useGetUser(id: string) {
  return useGetUserGenerated(id);
}
```

Use o gerado direto.

---

## 8. State management

Decisão por categoria:

| Tipo de estado | Onde |
|---|---|
| Server data | TanStack Query (via hooks Kubb) |
| Params de rota | `useLocalSearchParams()` (Expo Router) |
| Form state | React Hook Form |
| UI efêmero local (modal, foco) | `useState` |
| UI compartilhado entre telas | Zustand (`src/stores/`) |
| Auth (identidade) | `AuthContext` (JWT próprio + Google) — ver [`AUTH.md`](./AUTH.md); sem camada de papéis |
| Timezone override | Zustand persistido — ver [`DATES.md`](./DATES.md) |

Detalhes em [`STATE.md`](./STATE.md).

**Regra-mor:** server state **nunca** em `useState`/Zustand. Sempre TanStack Query. **Sem state manager global por padrão** — Zustand só entra quando TanStack Query + params de rota não bastam.

**QueryClient é singleton.** Um único `queryClient` em `src/api/query-client.ts` (`staleTime: 30s`, `retry: 1`). Nunca crie `new QueryClient()` dentro de componente. Exceção: testes.

---

## 9. Tratamento de erros

### 9.1 Erros de API

```tsx
const { data, error, isError, refetch } = useListUsers();
if (isError) return <ErrorState error={error} onRetry={refetch} />;
```

### 9.2 Erros de tela / navegação

Expo Router suporta `ErrorBoundary` exportado de um layout de rota:

```tsx
// src/app/(tabs)/users/_layout.tsx
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return <ErrorState error={error} onRetry={retry} />;
}
```

### 9.3 Erros globais

Sentry é inicializado via `Sentry.init` + `Sentry.wrap(RootLayout)` no root `_layout.tsx` — captura crashes nativos e JS. Detalhes em [`OBSERVABILITY.md`](./OBSERVABILITY.md).

---

## 10. Checklist para uma feature nova

- [ ] Tela criada em `src/app/...` (grupo `(tabs)`/`(auth)`; `export default`); params via `useLocalSearchParams()` (Zod se precisar validar)
- [ ] `components/<modulo>/` com filenames kebab-case (`my-component.tsx`), primitivos RN (sem DOM)
- [ ] `hooks/<modulo>/` com hooks customizados se necessário (`use-x.ts`)
- [ ] `schemas/<modulo>/` com schemas Zod se o módulo tiver forms (mensagens via chaves i18n — [`FORMS.md`](./FORMS.md))
- [ ] Componente principal recebe filtros já parseados como props
- [ ] Usa hooks gerados pelo Kubb (sem `fetch` manual, sem service layer)
- [ ] Listas longas com `FlatList`/`FlashList` (`keyExtractor`, itens memoizados) — nunca `.map()` em `ScrollView`
- [ ] Skeleton durante loading, `<ErrorState>` em erro, `<EmptyState>` em lista vazia
- [ ] Forms via React Hook Form + Zod resolver
- [ ] Mutations invalidam queries certas via `USERS.queryKeyRoot` (por módulo, não string crua)
- [ ] Toast de feedback em mutations
- [ ] Texto via `t()` — nada hardcoded ([`I18N.md`](./I18N.md))
- [ ] Estilo via NativeWind `className`; dark mode via `dark:` + `useColorScheme` ([`STYLING.md`](./STYLING.md))
- [ ] Acessibilidade: `accessibilityRole`/`accessibilityLabel`, alvos ≥ 44pt
- [ ] Teste de integração (Jest + @testing-library/react-native + MSW) cobrindo happy + erro ([`TESTING.md`](./TESTING.md))
- [ ] Sem `any`, sem `console.log`, sem `useState` para dados de API
