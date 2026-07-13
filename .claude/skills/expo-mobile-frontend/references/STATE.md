# STATE.md — Gerenciamento de Estado (React Native)

> Server state ≠ UI state. **TanStack Query** cuida de tudo que vem da API (cache, sync, dedup, retry) — igualzinho ao web. **Zustand** entra apenas quando há UI state genuinamente compartilhado entre telas. **React state** local cobre o resto. O que muda vs. web: persistência é **AsyncStorage / expo-secure-store** (não localStorage), e não há "abas" pra sincronizar. Contexto geral em [`../SKILL.md`](../SKILL.md).

---

## 1. Decisão por categoria

| Tipo de estado | Onde |
|---|---|
| Dados do servidor (lista de usuários, detalhe, settings persistidos) | **TanStack Query** |
| Filtros, paginação, ordenação, tab ativa | **Expo Router search params** (`useLocalSearchParams` + `router.setParams`) ou `useState` local |
| Form em edição | **React Hook Form** (ver [`FORMS.md`](./FORMS.md)) |
| Modal/sheet aberto, foco, item expandido (UI efêmero local) | **`useState`** local |
| Tema, densidade, tab preferida (UI compartilhado entre telas) | **Zustand** (+ persist em AsyncStorage) |
| Token de auth | **Access/refresh JWT → `expo-secure-store`** (não cookies, não localStorage; veja [`AUTH.md`](./AUTH.md)) |

**Regra-mor:** dado que veio da API **sempre** mora em TanStack Query. Nunca copie para `useState`/Zustand.

---

## 2. TanStack Query — patterns essenciais

Funciona igual em RN — mesma lib, mesmos hooks. Só a integração com o "focus"/"online" muda (ver §2.1).

### 2.1 Setup do QueryClient — singleton global

**Existe UM queryClient em todo o app.** Criado uma vez em módulo top-level, importado pelo root layout do Expo Router.

```tsx
// src/api/query-client.ts (estado atual do repo — config enxuta)
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // dados "frescos" por 30s
      retry: 1,
    },
  },
});
```

> **`refetchOnWindowFocus` não existe em RN** (não há janela de browser). O equivalente é conectar o `focusManager` do TanStack Query ao `AppState` do RN e o `onlineManager` ao NetInfo, para refetch quando o app volta ao foreground / recupera conexão:
>
> ```ts
> import { AppState } from "react-native";
> import { focusManager, onlineManager } from "@tanstack/react-query";
> import * as Network from "expo-network";
>
> AppState.addEventListener("change", (status) => {
>   focusManager.setFocused(status === "active");
> });
> // onlineManager.setEventListener(...) com expo-network / @react-native-community/netinfo
> ```
>
> As opções recomendadas a adicionar quando precisar (retry condicional por status, `gcTime`, `mutations.retry: false`):
>
> ```ts
> retry: (failureCount, error) =>
>   error instanceof ApiError && error.status < 500 ? false : failureCount < 2,
> ```

### 2.2 Providers no root layout (Expo Router)

Não há `main.tsx`/`createRoot`/`RouterProvider`. Os providers moram no `src/app/_layout.tsx`, envolvendo o `<Stack>`/`<Slot>` do Expo Router.

```tsx
// src/app/_layout.tsx (trecho)
import { QueryClientProvider } from "@tanstack/react-query";
import { Slot } from "expo-router";
import { queryClient } from "@/api/query-client";
import { AuthProvider } from "@/contexts/auth-context";

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Slot />
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

> Expo Router não tem "router context" com `queryClient` injetado nem `loader` de rota (isso é do TanStack Router, do web). Prefetch é feito com `queryClient.prefetchQuery(...)` na navegação — ver [`KUBB.md`](./KUBB.md) §7.3.

### 2.3 Como acessar o queryClient

| Onde | Como |
|---|---|
| Em componente/tela | `const queryClient = useQueryClient()` (hook, lê do Provider) |
| Em prefetch antes de navegar | `queryClient.prefetchQuery(get<Op>QueryOptions(...))` |
| Em handler fora de componente (raro) | Importe diretamente `import { queryClient } from "@/api/query-client"` |

**Nunca crie `new QueryClient()` num componente.** Isso descarta o cache global e recria do zero a cada render — bug clássico.

```tsx
// ❌ ERRADO — cria novo a cada render
function MyComponent() {
  const queryClient = new QueryClient();
}

// ✅ CORRETO
function MyComponent() {
  const queryClient = useQueryClient(); // lê o global do contexto
}
```

**Exceções legítimas para criar QueryClient novo:**
- **Em testes** — cache vazio entre testes, retry desligado, gc imediato. Use `renderWithProviders` (ver [`TESTING.md`](./TESTING.md)).

### 2.4 Usar hooks gerados pelo Kubb

```tsx
const { data, isLoading, isError, error, refetch } = useListUsers({ page: 1 });
```

Veja [`KUBB.md`](./KUBB.md). (Nome do hook = `operationId`.)

### 2.5 Invalidar após mutation

```tsx
const queryClient = useQueryClient();
const { mutate } = useCreateUser({
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: USERS.queryKeyRoot });
  },
});
```

**Granularidade:** queryKeys do Kubb são **baseadas em objeto** (`[{ url, params? }]`). Invalide a coleção do módulo com `USERS.queryKeyRoot`; um item específico com `getUserQueryKey(userId)`. Ver [`KUBB.md` §8](./KUBB.md#8-querykey-conventions).

### 2.6 Optimistic updates

Atualize a UI **antes** da resposta do servidor, com rollback em erro:

```tsx
import { getUserQueryKey } from "@/api/generated/hooks/usersHooks/useGetUser";
import { toast } from "@/lib/toast";

const { mutate } = useUpdateUser({
  onMutate: async ({ userId, data }) => {
    const key = getUserQueryKey(userId);
    await queryClient.cancelQueries({ queryKey: key });
    const previous = queryClient.getQueryData(key);
    queryClient.setQueryData(key, (old: User) => ({ ...old, ...data }));
    return { previous, userId };
  },
  onError: (_err, _vars, context) => {
    if (context) {
      queryClient.setQueryData(getUserQueryKey(context.userId), context.previous);
      toast.error("Não foi possível atualizar; mudanças revertidas");
    }
  },
  onSettled: (_data, _err, { userId }) => {
    queryClient.invalidateQueries({ queryKey: getUserQueryKey(userId) });
  },
});
```

**Quando usar:** ações que o usuário espera "instantâneas" (toggle de favorito, marcar como lido). Em mobile isso é ainda mais importante porque a latência de rede móvel é visível.

**Quando NÃO usar:** ações destrutivas (delete), ações com validação de servidor crítica.

### 2.7 Pre-fetch antes de navegar

Sem `loader`. Aqueça o cache no `onPressIn` da linha ou num `useEffect` da lista:

```tsx
import { getUserQueryOptions } from "@/api/generated/hooks/usersHooks/useGetUser";

const queryClient = useQueryClient();
// no onPressIn de um <Link>/<Pressable> que navega pro detalhe:
queryClient.prefetchQuery(getUserQueryOptions(userId));
```

Cache aquecido → sem flicker quando a tela de detalhe monta. Ver [`KUBB.md`](./KUBB.md) §7.3.

### 2.8 Pagination

```tsx
const [page, setPage] = useState(1);
const { data, isPlaceholderData } = useListUsers(
  { page, pageSize: 20 },
  { placeholderData: (prev) => prev }, // keep previous data v5
);
```

`placeholderData: (prev) => prev` mantém dados anteriores visíveis enquanto carrega a próxima página. Evita flash de skeleton.

### 2.9 Infinite scroll (o padrão em mobile)

Listas longas em mobile quase sempre usam scroll infinito com `FlatList`/`FlashList` (nunca `.map()` dentro de `ScrollView` — ver [`PERFORMANCE.md`](./PERFORMANCE.md)):

```tsx
import { useInfiniteQuery } from "@tanstack/react-query";
import { FlatList } from "react-native";
import { listUsers } from "@/api/generated/hooks/usersHooks/useListUsers";

const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useInfiniteQuery({
  queryKey: ["users", "infinite"],
  queryFn: ({ pageParam = 1 }) => listUsers({ page: pageParam, pageSize: 20 }), // função pura do hook gerado
  initialPageParam: 1,
  getNextPageParam: (lastPage) =>
    lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
});

const allItems = data?.pages.flatMap((p) => p.items) ?? [];

<FlatList
  data={allItems}
  keyExtractor={(u) => u.id}
  renderItem={({ item }) => <UserRow user={item} />}
  onEndReached={() => hasNextPage && fetchNextPage()}
  onEndReachedThreshold={0.5}
/>;
```

`onEndReached` do `FlatList` dispara o `fetchNextPage` — não é preciso `IntersectionObserver` (que é do DOM).

### 2.10 Loading patterns

```tsx
const { data, isLoading } = useGetUser(id);
if (isLoading || !data) return <Skeleton />;
return <UserCard user={data} />;
```

Se você fez `prefetchQuery` antes de navegar, `data` já está quente e não há flash de skeleton. `useQuery` retorna `data: undefined | T` por default — sempre cheque.

---

## 3. Expo Router search params como state

Filtros, paginação, ordenação, tabs — podem viver nos params da rota. Persistem no histórico de navegação e a tela fica deep-linkável.

```tsx
// src/app/(tabs)/users/index.tsx
import { useLocalSearchParams, router } from "expo-router";
import { z } from "zod";

const searchSchema = z.object({
  search: z.string().optional(),
  role: z.enum(["admin", "user", "viewer"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  sortBy: z.enum(["name", "createdAt"]).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export default function UsersScreen() {
  const raw = useLocalSearchParams();
  const search = searchSchema.parse(raw);

  const setSearchText = (text: string) => {
    // atualiza os params da rota (equivalente ao navigate({ search }) do web)
    router.setParams({ search: text, page: "1" });
  };

  return (
    <>
      <SearchInput defaultValue={search.search} onChangeText={setSearchText} />
      <UsersList filters={search} />
    </>
  );
}
```

**Padrões:**
- Reset `page: 1` ao mudar filtro.
- Debounce ao digitar em search (`useDebounce`) — evita spam de params + refetch em rede móvel.
- Defaults no schema evitam params redundantes.

> Params de rota são **strings** — daí `z.coerce.number()` e `page: "1"`. Para state efêmero que não precisa ser deep-linkável (ex.: aba selecionada dentro de uma tela), `useState` local é mais simples que params.

---

## 4. Zustand — quando e como

### 4.1 Quando usar

- Tema (light/dark override, se não seguir só o `colorScheme` do sistema)
- Densidade / view mode de listas que várias telas leem
- Sheet/drawer global que pode ser aberto de qualquer lugar
- Preferências de UI compartilhadas entre telas

### 4.2 Quando NÃO usar

- Dados da API → TanStack Query
- Filtros/paginação → search params ou `useState`
- Estado de form → RHF
- Estado local de uma tela → `useState`

### 4.3 Setup mínimo (persist em AsyncStorage, não localStorage)

```bash
pnpm add zustand
npx expo install @react-native-async-storage/async-storage
```

```ts
// src/stores/ui-store.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

type UiState = {
  listDensity: "comfortable" | "compact";
  setListDensity: (v: UiState["listDensity"]) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      listDensity: "comfortable",
      setListDensity: (v) => set({ listDensity: v }),
    }),
    {
      name: "ui-store",
      // RN não tem localStorage — persist usa AsyncStorage
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
```

> **Dados sensíveis (tokens, PII) nunca em AsyncStorage** — é texto plano no device. Use `expo-secure-store` (Keychain/Keystore). O access/refresh JWT já ficam lá (ver [`AUTH.md`](./AUTH.md)). Zustand `persist` também aceita um adapter de secure-store se precisar persistir algo sensível.

### 4.4 Uso

```tsx
function UsersList() {
  const density = useUiStore((s) => s.listDensity);
  // ...
}
```

**Selecionar slice mínimo** (`s => s.listDensity`) evita re-renders desnecessários.

### 4.5 Stores específicas, não monolíticas

Um store por **domínio de UI** (`useUiStore`, `useTableStore`, …). Evite "global app store" — vira gargalo.

---

## 5. Comunicação entre telas não-relacionadas

**Problema:** tela A dispara um evento; tela B (noutra parte da navegação) precisa reagir.

**Soluções (em ordem de preferência):**

1. **TanStack Query invalidation** se for dado. A criou → invalida query → B refetch (ao voltar ao foco).
2. **Zustand store** se for UI state genuíno.
3. **Params de rota** para passar valores ao navegar (`router.push({ pathname, params })`).

```tsx
// Antipattern comum, evite
const [trigger, setTrigger] = useState(0);
useEffect(() => { /* re-fetch */ }, [trigger]);
```

Use TanStack Query corretamente.

---

## 6. Persistência entre sessões

| Dado | Onde |
|---|---|
| Preferências UI (tema, densidade) | Zustand `persist` → **AsyncStorage** |
| Tokens de auth | Access/refresh JWT → **expo-secure-store** (Keychain/Keystore) |
| Filtros recentes | TanStack Query + params (se cabível) |
| Rascunho de form | AsyncStorage manual com debounce |
| Dados sensíveis (tokens, PII) | **Nunca** AsyncStorage; use expo-secure-store ou só memória |

> Regra de ouro: **AsyncStorage = preferências não-sensíveis**; **expo-secure-store = segredos**. Não há `localStorage`/`sessionStorage` em RN.

---

## 7. Sincronização entre "instâncias"

No web havia sincronização entre abas (logout numa aba refletir em outra). **Em mobile isso não existe** — o app é uma única instância. O que substitui:

- **Logout:** `forceLogout()` limpa a sessão (`expo-secure-store`), chama `queryClient.clear()` e navega pra `(auth)/sign-in`. Como só há uma instância, não há `BroadcastChannel`/`storage` event a ouvir (ambos são APIs de browser).
- **Expiração de token:** o `401` no client de API dispara `forceLogout()` (ver [`KUBB.md`](./KUBB.md) §6 e [`AUTH.md`](./AUTH.md)).
- **Multi-device (mesmo usuário em dois aparelhos):** é responsabilidade do backend (revogar refresh token); o app reage ao próximo `401`.

```ts
// src/lib/auth/session.ts (trecho)
export async function forceLogout() {
  await fetch(`${API}/auth/logout`, { method: "POST", /* { refreshToken } */ }); // revoga no backend
  await signOutGoogle();         // encerra a sessão Google no device
  await clearTokens();           // limpa access/refresh do expo-secure-store
  queryClient.clear();           // descarta o cache
  router.replace("/(auth)/sign-in");
}
```

---

## 8. Patterns importantes

### 8.1 Selectors estáveis em Zustand

```tsx
// ❌ retorna novo objeto a cada render → re-render infinito
const { x, y } = useStore((s) => ({ x: s.x, y: s.y }));

// ✅ selectors individuais
const x = useStore((s) => s.x);
const y = useStore((s) => s.y);

// ✅ ou shallow comparator
import { useShallow } from "zustand/react/shallow";
const { x, y } = useStore(useShallow((s) => ({ x: s.x, y: s.y })));
```

### 8.2 Não inicialize TanStack Query num useEffect

```tsx
// ❌
useEffect(() => { queryClient.fetchQuery(...); }, []);

// ✅ use o hook no top level
const { data } = useQuery(...);
```

### 8.3 Não chame hooks dentro de callbacks

```tsx
// ❌
<Pressable onPress={() => { const { data } = useGetUser(id); }}>
```

Hooks só no top level. Para mutations, use `useMutation` no top level e `mutate()` no callback.

---

## 9. Debugging

- **React Query Devtools:** o painel web (`@tanstack/react-query-devtools`) não roda embutido em RN. Use uma destas opções:
  - **`react-native-react-query-devtools`** / plugin do **Reactotron** para inspecionar o cache no device.
  - O **Expo DevTools plugin** de React Query (`@dev-plugins/react-query`), habilitado só em `__DEV__`.
- **Zustand + Reactotron/Redux DevTools:**
  ```ts
  import { devtools } from "zustand/middleware";
  create(devtools((set) => ({ /* ... */ }), { name: "ui-store", enabled: __DEV__ }));
  ```
- Guarde qualquer instrumentação de dev atrás de `__DEV__` (constante global do RN, substitui `import.meta.env.DEV`).

---

## 10. Checklist de state

- [ ] Dados de API estão em TanStack Query (não copiados para `useState`)
- [ ] Filtros/paginação em search params (`useLocalSearchParams`) ou `useState` — não perdidos sem querer
- [ ] Form usa React Hook Form (não `useState` por campo)
- [ ] Zustand store específica do domínio (não god-object)
- [ ] Zustand `persist` usa `createJSONStorage(AsyncStorage)` — nunca localStorage
- [ ] Dados sensíveis em `expo-secure-store`, nunca AsyncStorage
- [ ] Selector Zustand seleciona slice mínimo
- [ ] Mutations invalidam queries certas no `onSuccess`
- [ ] Optimistic update tem rollback em `onError`
- [ ] Sem `useEffect` para fetch de dados (use hooks gerados)
- [ ] Pre-fetch via `queryClient.prefetchQuery` antes de navegar (telas pesadas)
- [ ] `focusManager`/`onlineManager` ligados a AppState/NetInfo (não `refetchOnWindowFocus`)
- [ ] Instrumentação de devtools atrás de `__DEV__`
