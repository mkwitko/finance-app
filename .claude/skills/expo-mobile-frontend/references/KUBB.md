# KUBB.md — Geração de API Client a partir do OpenAPI

> O contrato entre backend e frontend é o **OpenAPI** gerado pelo Fastify. Kubb lê esse arquivo e gera **types + TanStack Query hooks** automaticamente. Você nunca escreve um `fetch` à mão. Padrão idêntico ao do frontend web da empresa — só o runtime muda (React Native, não browser). Contexto geral em [`../SKILL.md`](../SKILL.md).

---

## 1. Fluxo end-to-end

```
[Backend: Fastify + Zod + @fastify/swagger]
              │
              │ Zod → OpenAPI (fastify-type-provider-zod) → GET /openapi.json
              ▼
[api.json]  ── fixture OpenAPI commitada na raiz do repo (input do Kubb)
              │
              │ pnpm api:generate (kubb generate)
              ▼
[Kubb processa]
              │
              ├──► src/api/generated/types/             (TypeScript types)
              └──► src/api/generated/hooks/<tag>Hooks/  (TanStack Query hooks)
              │
              ▼
[Telas/componentes consomem]
   useListUsers(), useCreateUser(), useGetRfp(), etc  (nome = operationId)
```

**A consequência prática:** mudar o schema no backend Fastify (refletido em `api.json`) quebra o type-check do app no CI. Sem desincronização possível.

> **Hoje o Kubb lê a fixture local `api.json`**, não baixa do backend. Para apontar ao backend real, troque `input.path` em `kubb.config.ts` por uma URL do `openapi.json`. Não há plugin de client (`pluginClient`) nem de Zod (`pluginZod`) — só `pluginOas`, `pluginTs` e `pluginReactQuery`. Logo, **não há** `clients/` nem `zod/` em `generated/`.

---

## 2. Como o backend expõe o OpenAPI

Já está configurado no backend. O backend valida com **Zod** e deriva o OpenAPI via `fastify-type-provider-zod` (veja docs do backend, seção `app.ts`):

```ts
// backend/src/app.ts
import { jsonSchemaTransform } from "fastify-type-provider-zod";

await app.register(import("@fastify/swagger"), {
  openapi: {
    info: { title: "Finance API", version: "1.0.0" },
    servers: [{ url: env.API_BASE_URL }],
    components: {
      securitySchemes: {
        BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
  },
  transform: jsonSchemaTransform, // Zod → JSON Schema no OpenAPI
});
await app.register(import("@fastify/swagger-ui"), { routePrefix: "/docs" });
```

Disponível em:
- `GET /docs` — UI interativa
- `GET /docs/json` — `openapi.json` (fonte da fixture `api.json` deste repo)

> Neste repo o `openapi.json` exportado pelo backend é versionado como `api.json` na raiz, e é esse arquivo que o Kubb consome. Regerar a fixture = copiar a saída atual de `/docs/json` por cima de `api.json`.

---

## 3. Configuração do Kubb

```ts
// kubb.config.ts
import { type Config, defineConfig } from "@kubb/core";
import { pluginOas } from "@kubb/plugin-oas";
import { pluginReactQuery } from "@kubb/plugin-react-query";
import { pluginTs } from "@kubb/plugin-ts";

export default defineConfig({
  root: ".",
  input: {
    path: "api.json", // fixture local; troque por uma URL para usar o backend ao vivo
  },
  output: {
    path: "./src/api/generated",
    clean: true,
  },
  plugins: [
    pluginOas(),

    // Types TypeScript puros de schemas
    pluginTs({
      output: { path: "./types" },
      dateType: "date",
      enumType: "asConst",
    }),

    // TanStack Query hooks
    pluginReactQuery({
      output: { path: "./hooks" },
      client: {
        importPath: "@/api/client", // nosso wrapper de fetch (roda em RN)
        dataReturnType: "data",
      },
      query: {
        methods: ["get"],
        importPath: "@tanstack/react-query",
      },
      mutation: {
        methods: ["post", "put", "delete"],
      },
      group: {
        type: "tag",
        name: ({ group }) => `${group}Hooks`, // tag `users` → pasta usersHooks/
      },
    }),
  ],
}) satisfies Config;
```

**Notas:**
- Só **três** plugins: `pluginOas`, `pluginTs`, `pluginReactQuery`. Sem `pluginClient` e sem `pluginZod` — não geramos `clients/` nem `zod/`.
- `dateType: "date"` → campos de data viram `Date` nos types gerados.
- `group.type: "tag"` agrupa hooks por tag do OpenAPI em pastas `${tag}Hooks/`. Endpoints **sem tag** caem em `undefinedHooks/`.
- Métodos query = `get`; mutation = `post`/`put`/`delete` (sem `patch` na config atual).
- `client.importPath` aponta para `@/api/client` — o wrapper mora em `src/api/client.ts`, não em `src/lib/`. O client de API é o coração type-safe do projeto e vive fora de `lib/`.

---

## 4. Scripts e workflow

### 4.1 Scripts em `package.json`

```json
{
  "scripts": {
    "api:generate": "kubb generate",
    "api:watch":    "kubb generate --watch"
  }
}
```

Sem `api:fetch`/`prestart`/`prebuild`: o Kubb lê a fixture local `api.json`, então não há passo de download nem regeração automática antes de `start`/`build`.

### 4.2 Em desenvolvimento

```bash
pnpm api:generate   # regenera src/api/generated/ a partir de api.json
pnpm api:watch      # regenera ao mudar a spec
```

Para gerar contra o backend ao vivo, troque `input.path` em `kubb.config.ts` por uma URL (ex.: `http://localhost:3000/docs/json`) antes de rodar.

### 4.3 Em CI/CD

Como a fixture `api.json` é commitada, o build (EAS) não depende do backend no ar. O fluxo recomendado quando o contrato muda: atualizar `api.json` (copiando a saída de `/docs/json` do backend), rodar `pnpm api:generate`, e commitar a fixture + os tipos regenerados. Veja [`DEPLOYMENT.md`](./DEPLOYMENT.md).

### 4.4 `api.json` e `generated/` no Git?

- **`api.json`** (fixture OpenAPI): **commitado**, é o input do Kubb.
- **`src/api/generated/`**: **gitignored** (regenerado pelo Kubb).

```
# .gitignore
src/api/generated/
```

Razão: o código gerado é grande e causa conflitos em merge; a fixture é a fonte versionada.

---

## 5. Estrutura do código gerado

```
src/api/generated/
├── types/
│   ├── CreateUser.ts           # types do request/response da operação
│   ├── GetRfp.ts               # GetRfpQueryResponse, GetRfpPathParams, ...
│   ├── GetAuthenticatedUser.ts
│   ├── GetHealth.ts
│   ├── ListRfp.ts
│   ├── UpdateRfp.ts
│   └── index.ts                # barrel
├── hooks/
│   ├── rfpHooks/               # tag `rfp`
│   │   ├── useGetRfp.ts        # useQuery + getRfp() + getRfpQueryOptions/getRfpQueryKey
│   │   ├── useGetRfpSuspense.ts# variante useSuspenseQuery
│   │   ├── useListRfp.ts
│   │   ├── useListRfpSuspense.ts
│   │   ├── useCreateRfp.ts     # useMutation
│   │   ├── useDeleteRfp.ts     # useMutation
│   │   └── index.ts
│   ├── usersHooks/             # tag `users`
│   │   ├── useGetAuthenticatedUser.ts
│   │   ├── useGetAuthenticatedUserSuspense.ts
│   │   └── index.ts
│   ├── undefinedHooks/         # endpoints SEM tag (ex.: /health)
│   │   ├── useGetHealth.ts
│   │   ├── useGetHealthSuspense.ts
│   │   └── index.ts
│   └── index.ts                # barrel (hooks + types)
├── .kubb/                      # metadados internos do Kubb
└── index.ts                    # barrel raiz
```

**Convenções:**
- Nomes de operações vêm do `operationId` do OpenAPI: `operationId: "getRfp"` → hook `useGetRfp` (**sem** prefixo de tag — não é `useRfpGetRfp`).
- Cada query gera **duas** variantes: `useGetRfp` (`useQuery`) e `useGetRfpSuspense` (`useSuspenseQuery`).
- Cada arquivo de query também exporta a função pura (`getRfp`), `getRfpQueryOptions(...)` (pra prefetch) e `getRfpQueryKey(...)`.
- Tags do OpenAPI viram pastas `${tag}Hooks/`. Endpoints sem tag caem em `undefinedHooks/` — defina tags no backend pra evitar isso (ex.: `/health` hoje cai lá).

---

## 6. Client customizado (wrapper de fetch)

Kubb gera hooks que delegam a um arquivo seu (`client.importPath`). Esse arquivo controla auth, base URL e error handling. Os hooks importam o **default export** dele. **Roda no runtime nativo (Hermes)** — sem cookies, sem `document`; o access JWT (emitido pelo backend) vem de `expo-secure-store` via `getJwtToken()`.

```ts
// src/api/client.ts
import { env } from "@/env";
import { forceLogout, getJwtToken } from "@/lib/auth";

export type RequestConfig<TData = unknown> = {
  method?: "GET" | "PUT" | "PATCH" | "POST" | "DELETE" | "OPTIONS" | "HEAD";
  url?: string;
  baseURL?: string;
  params?: Record<string, unknown>;
  data?: TData | FormData;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export type ResponseConfig<TData = unknown> = {
  data: TData;
  status: number;
  statusText: string;
  headers: Headers;
};

export type ResponseErrorConfig<TError = unknown> = {
  data: TError;
  status: number;
  statusText: string;
};

/** Tipo da função client — usado pelos hooks gerados (opção `client?`). */
export type Client = <TData, _TError = unknown, TVariables = unknown>(
  config: RequestConfig<TVariables>,
) => Promise<ResponseConfig<TData>>;

export class ApiError<TError = unknown> extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly data: TError,
  ) {
    super(`API ${status} ${statusText}`);
    this.name = "ApiError";
  }
}

const IS_TEST = process.env.NODE_ENV === "test";

async function client<TData, _TError = unknown, TVariables = unknown>(
  config: RequestConfig<TVariables>,
): Promise<ResponseConfig<TData>> {
  const baseURL = config.baseURL ?? env.API_BASE_URL;
  const url = `${baseURL}${config.url ?? ""}${buildQuery(config.params)}`;

  const headers = new Headers(config.headers);
  // Access JWT do app (emitido pelo backend, guardado em expo-secure-store), não cookie.
  const token = await getJwtToken();                    // renova via /auth/refresh se expirou
  if (token) headers.set("Authorization", `Bearer ${token}`); // JWT nosso → prefixo "Bearer"

  // ... monta body (JSON ou FormData) ...

  const res = await fetch(url, {
    method: config.method ?? "GET",
    headers,
    body,
    signal: config.signal,
  });

  // 401 (token inválido e o /auth/refresh feito em getJwtToken não resolveu) → logout global.
  // forceLogout() limpa a sessão e manda o usuário de volta pra tela de sign-in.
  if (res.status === 401 && !IS_TEST) await forceLogout();

  if (!res.ok) throw new ApiError(res.status, res.statusText, payload);
  return { data: payload as TData, status: res.status, statusText: res.statusText, headers: res.headers };
}

export default client;
```

**Diferenças importantes do client padrão de exemplo:**
- Token via `getJwtToken()` (access JWT do app em `expo-secure-store`; renova pelo `/auth/refresh`), enviado **com prefixo `Bearer`** (`Authorization: Bearer <token>`). Detalhes em [`AUTH.md`](./AUTH.md).
- `401` chama `forceLogout()` (limpa sessão + navega pra `(auth)/sign-in`) fora do ambiente de teste. **Não há cookie/CookieStorage** — isso é web; em RN a sessão vive no secure store.
- `ApiError(status, statusText, data)` — carrega o payload de erro cru em `.data`, não um `code`/`traceId`.
- Suporta `FormData` (uploads): não seta `Content-Type` quando o body é `FormData` — mas para presigned URL o PUT vai direto pro S3 (ver [`UPLOADS.md`](./UPLOADS.md)).
- `fetch` e `AbortSignal` são nativos no runtime RN (Hermes) — nenhum polyfill de browser envolvido.

---

## 7. Consumindo os hooks gerados

### 7.1 Query (leitura)

```tsx
import { useListUsers } from "@/api/generated/hooks/usersHooks/useListUsers";
import { UsersListView } from "@/components/users/users-list";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";

function UsersScreen() {
  const { data, isLoading, error } = useListUsers(
    { page: 1, pageSize: 20 },
    {
      // opções do TanStack Query
      staleTime: 30_000,
      placeholderData: (prev) => prev, // keepPreviousData v5
    },
  );

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorState error={error} />;
  return <UsersListView data={data.items} />;
}
```

### 7.2 Mutation (escrita)

Num form, a mutation dispara no `handleSubmit` do React Hook Form (ver [`FORMS.md`](./FORMS.md)) — não existe `<form onSubmit>` em RN.

```tsx
import { useCreateUser } from "@/api/generated/hooks/usersHooks/useCreateUser";
import { useQueryClient } from "@tanstack/react-query";
import { USERS } from "@/api/modules";
import { toast } from "@/lib/toast"; // wrapper de toast nativo

function useCreateUserWithFeedback() {
  const queryClient = useQueryClient();
  return useCreateUser({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS.queryKeyRoot });
      toast.success("Usuário criado");
    },
    onError: (err) => {
      // err é ApiError tipado
      toast.error(err.message);
    },
  });
}
```

### 7.3 Pré-busca antes de navegar

Expo Router **não tem `loader` de rota** (isso é do TanStack Router, do web). Para aquecer o cache antes de abrir uma tela de detalhe, use `queryClient.prefetchQuery` com o `get<Op>QueryOptions` gerado — tipicamente no `onPress` da linha da lista:

```tsx
// src/components/users/users-list.tsx
import { useQueryClient } from "@tanstack/react-query";
import { getUserQueryOptions } from "@/api/generated/hooks/usersHooks/useGetUser";
import { Link } from "expo-router";
import { Pressable } from "react-native";

function UserRow({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  return (
    <Link href={`/users/${userId}`} asChild>
      <Pressable
        onPressIn={() => queryClient.prefetchQuery(getUserQueryOptions(userId))}
      >
        {/* ... */}
      </Pressable>
    </Link>
  );
}
```

Na tela de detalhe, o `id` vem de `useLocalSearchParams()` e o hook já acha o dado quente no cache:

```tsx
// src/app/(tabs)/users/[id].tsx
import { useLocalSearchParams } from "expo-router";
import { useGetUser } from "@/api/generated/hooks/usersHooks/useGetUser";
import { UserCard } from "@/components/users/user-detail";

export default function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: user } = useGetUser(id); // sem flicker se foi feito prefetch
  return <UserCard user={user} />;
}
```

> Cada arquivo de query exporta `get<Op>QueryOptions(...)` (função). Use-a no prefetch. Navegação com Expo Router em [`NAVIGATION.md`](./NAVIGATION.md).

---

## 8. QueryKey conventions

Kubb gera `queryKey`s **baseadas em objeto**, no formato `[{ url, params? }]` — o `url` é o path com placeholders e `params` carrega os path params. Não é `[<modulo>, <method>, <path>]`.

```
useListUsers()          → [{ url: "/users" }]
useGetRfp("abc")        → [{ url: "/rfp/:id", params: { id: "abc" } }]
```

Cada hook expõe também `get<Op>QueryKey(...)` que devolve exatamente essa key.

### 8.1 Constantes por módulo — não escreva strings cruas

Pra invalidação, **nunca use string literal**. Cada módulo exporta seu próprio objeto de constantes, incluindo um `queryKeyRoot` que casa com o prefixo das keys geradas:

```ts
// src/api/modules/users.ts
export const USERS = {
  ENDPOINT: "/users",
  queryKeyRoot: [{ url: "/users" }] as const,
} as const;
```

E o barrel pra importação centralizada:

```ts
// src/api/modules/index.ts
export { USERS } from "./users";
```

**Por que objeto por módulo (não `MODULES.USERS`):**
- Combina com a arquitetura por módulo (`components/users/`, `modules/users.ts`).
- Cada módulo pode crescer (paths adicionais, defaults) sem virar dicionário gigante.
- Refactor-safe (IDE renomeia), evita typo, detect-usages funciona.

> Hoje só existe `users.ts` em `src/api/modules/`. Crie um arquivo por módulo conforme novas tags/endpoints surgem.

### 8.2 Padrões de invalidação

```ts
import { useQueryClient } from "@tanstack/react-query";
import { USERS } from "@/api/modules";

const queryClient = useQueryClient();

// Coleção do módulo (mais comum em mutations) — casa com [{ url: "/users" }]
queryClient.invalidateQueries({ queryKey: USERS.queryKeyRoot });

// Um item específico — use a key gerada pelo próprio hook
import { getUserQueryKey } from "@/api/generated/hooks/usersHooks/useGetUser";
queryClient.invalidateQueries({ queryKey: getUserQueryKey(userId) });
```

> Para invalidar um endpoint específico, prefira `get<Op>QueryKey(...)` do hook gerado — assim a key fica sempre em sincronia com o que o Kubb produz.

### 8.3 Em mutations geradas — sempre invalide pelo módulo

```ts
// src/hooks/users/use-create-user.ts
import { useQueryClient } from "@tanstack/react-query";
import { useCreateUser as useCreateUserGenerated } from "@/api/generated/hooks/usersHooks/useCreateUser";
import { USERS } from "@/api/modules";
import { toast } from "@/lib/toast";
import { useTranslation } from "react-i18next";

export function useCreateUser() {
  const { t } = useTranslation("users");
  const queryClient = useQueryClient();

  return useCreateUserGenerated({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS.queryKeyRoot });
      toast.success(t("feedback.created"));
    },
    onError: () => toast.error(t("feedback.createError")),
  });
}
```

### 8.4 Adicionar módulo novo

Quando o backend adiciona uma tag nova (`payments`):

1. `pnpm api:generate` — Kubb gera hooks em `src/api/generated/hooks/paymentsHooks/`.
2. Crie `src/api/modules/payments.ts`:
   ```ts
   export const PAYMENTS = {
     ENDPOINT: "/payments",
     queryKeyRoot: [{ url: "/payments" }] as const,
   } as const;
   ```
3. Adicione no barrel `src/api/modules/index.ts`:
   ```ts
   export { PAYMENTS } from "./payments";
   ```
4. Use em mutations: `queryClient.invalidateQueries({ queryKey: PAYMENTS.queryKeyRoot })`.

---

## 9. Cuidados e gotchas

### 9.1 Mudanças de breaking no backend

Backend muda `email: string` → `email: { primary: string; secondary?: string }`. Você regenera. TypeScript do app quebra em **todos** os usos. Você corrige. **É a magia do contrato vivo.**

### 9.2 `operationId` obrigatório no backend

Sem `operationId`, Kubb inventa nomes feios (`postUsersV1`). O nome do hook é exatamente `use` + `operationId` (sem prefixo de tag). **Sempre** no schema do backend:

```ts
// backend (Zod + fastify-type-provider-zod)
app.post("/users", {
  schema: {
    tags: ["users"],
    operationId: "createUser", // ← obrigatório
    body: createUserBody,      // Zod schema
    response: { 201: userSchema },
  },
}, handler);
```

### 9.3 Schemas inline vs nomeados

Backend deve **registrar schemas Zod nomeados** (com `.meta({ id: "User" })` / `zodToJsonSchema` ref) quando possível, em vez de declarar inline em cada rota. Kubb gera tipos mais limpos e reutilizáveis.

### 9.4 Não edite arquivos gerados

`src/api/generated/` é regenerado a cada `kubb generate`. Mudanças manuais são perdidas. Se precisar customizar comportamento de uma chamada, faça wrapper:

```ts
// src/hooks/users/use-create-user-with-toast.ts
import { useCreateUser } from "@/api/generated/hooks/usersHooks/useCreateUser";
import { toast } from "@/lib/toast";

export const useCreateUserWithToast = () =>
  useCreateUser({ onSuccess: () => toast.success("OK") });
```

### 9.5 Sincronia em PRs cross-repo

Cenário: backend num PR, app noutro PR consumindo. Ordem:

1. Backend merge → staging → expõe o `openapi.json` atualizado.
2. App atualiza a fixture `api.json` (da saída de `/docs/json`), regenera (`pnpm api:generate`) → corrige tipos → PR merge → EAS Update no canal de staging.
3. Aprovação manual → ambos sobem para prod juntos (ou backend primeiro se mudança for backward-compatible).

Para mudanças breaking, **sempre 2-deploy** (igual ao schema do DB):
- v1 do backend introduz campo novo opcional.
- App usa.
- v2 do backend remove campo antigo (depois do app com o novo bundle estar entregue via EAS Update / store).

> Em mobile o "deploy" pode chegar via **EAS Update (OTA)** ou build na loja. Mudança breaking exige cuidado extra: usuários podem estar num bundle antigo por dias. Ver [`DEPLOYMENT.md`](./DEPLOYMENT.md).

---

## 10. Checklist ao adicionar endpoint novo

- [ ] Backend: schema **Zod** completo, `operationId` definido, tag certa (sem tag → cai em `undefinedHooks/`)
- [ ] Atualize a fixture `api.json` (copie a saída de `/docs/json` do backend)
- [ ] App: `pnpm api:generate`
- [ ] Verifique arquivos gerados em `src/api/generated/`
- [ ] Use o hook gerado direto na tela/componente
- [ ] Se precisar lógica extra, crie wrapper em `src/hooks/<modulo>/`
- [ ] Mutation invalida queries certas (`queryKeyRoot` do módulo)
- [ ] Teste de integração (MSW handler usa o mesmo type gerado para garantir mock sincronizado)
