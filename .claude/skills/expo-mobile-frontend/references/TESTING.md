# TESTING.md — Jest (jest-expo) + @testing-library/react-native + MSW + Maestro

> Filosofia: **teste como o usuário usa**. Procure elementos por texto, `accessibilityRole` e label — não por `testID` nem estrutura interna. Refatorar implementação sem quebrar testes deve ser regra, não exceção.
>
> **Expo mudou.** Confira a doc do Expo SDK 57 (jest-expo, Expo Router testing) em https://docs.expo.dev/versions/v57.0.0/ antes de configurar o runner.

---

## 1. Pirâmide

```
        /\
       /e2e\         poucos (~10-20)    — Maestro, fluxos críticos
      /------\
     /integr. \      vários (~30-80)    — Jest + RNTL + MSW
    /----------\
   /   unit     \    muitos (~centenas) — Jest + RNTL (componentes isolados)
  /--------------\
```

**Para o app, "unit" e "integração" se misturam.** A maioria dos seus testes são **de componente com MSW mockando a API** (técnicamente "integração"). É o sweet spot.

**Regra:** toda feature crítica tem teste.

---

## 2. Por que essa stack (recap)

- **Jest + `jest-expo`** — runner. O `jest-expo` é o preset oficial do Expo: transforma módulos RN/Expo, aplica os mocks nativos certos e roda em ambiente `node`. Vitest não roda bem o runtime RN — no mobile o padrão é Jest.
- **`@testing-library/react-native`** (RNTL) — abordagem "teste como usuário", queries por role/text/label, `userEvent`/`fireEvent` sobre a árvore RN. Matchers built-in (`toBeOnTheScreen`, `toHaveTextContent`) — **sem jest-dom**.
- **MSW** (Mock Service Worker) — intercepta `fetch` no nível de rede via `setupServer` (Node). Você não mocka módulos; mocka a **rede**.
- **Maestro** — E2E mobile em simulador/emulador (ou device), fluxos declarativos em YAML. Recomendado pelo Expo (não Playwright/Detox).

Detalhes da decisão em [`DECISIONS.md`](./DECISIONS.md).

---

## 3. Setup

### 3.1 Instalar

```bash
pnpm add -D jest jest-expo @testing-library/react-native react-test-renderer msw
```

### 3.2 Config do Jest — preset `jest-expo`

```jsonc
// jest.config.js (ou bloco "jest" no package.json)
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
  // Transforma os pacotes RN/Expo que vêm em ESM/Flow:
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|nativewind|posthog-react-native))",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/api/generated/**",       // código gerado pelo Kubb
    "!src/**/*.d.ts",
  ],
};
```

> `preset: "jest-expo"` já configura o `testEnvironment` e os transforms nativos. O `transformIgnorePatterns` precisa listar cada pacote RN/Expo que publica ESM — adicione novos quando um `import` de node_modules quebrar o parser.

### 3.3 Setup global

```ts
// test/setup.ts
import "@testing-library/react-native/extend-expect";   // matchers RNTL (toBeOnTheScreen, ...)
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import common from "../assets/locales/pt-BR/common.json";
import users from "../assets/locales/pt-BR/users.json";
import zod from "../assets/locales/pt-BR/zod.json";
import { server } from "./mocks/server";

// i18n REAL e síncrono com recursos embutidos (sem HTTP backend nos testes).
if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    lng: "pt-BR",
    fallbackLng: "pt-BR",
    ns: ["common", "zod", "users"],
    defaultNS: "common",
    resources: { "pt-BR": { common, zod, users } },
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

> O setup inicializa o **i18n real** (não um mock) com os JSONs de `pt-BR` embutidos — asserts veem o texto traduzido de verdade. A RNTL faz o `cleanup()` automático entre testes (não precisa chamar manualmente).

> **Datas em testes:** force `TZ=UTC` no script (`"test": "TZ=UTC jest"`) e use `jest.useFakeTimers()` + `jest.setSystemTime()` para "agora" determinístico. Detalhes em [`DATES.md`](./DATES.md).

### 3.4 MSW server (Node, para Jest)

```ts
// test/mocks/server.ts
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

```ts
// test/mocks/handlers.ts
import { http, HttpResponse } from "msw";
import { env } from "@/env";

const api = (path: string) => `${env.EXPO_PUBLIC_API_BASE_URL}${path}`;

export const handlers = [
  http.get(api("/users"), () => {
    return HttpResponse.json({
      items: [
        { id: "u1", email: "alice@b.com", name: "Alice", role: "user" },
        { id: "u2", email: "bob@b.com", name: "Bob", role: "admin" },
      ],
      page: 1,
      totalPages: 1,
    });
  }),
  http.post(api("/users"), async ({ request }) => {
    const body = (await request.json()) as { email: string; name: string };
    return HttpResponse.json({ id: "new-id", ...body, role: "user" }, { status: 201 });
  }),
];
```

> MSW roda em Node no jest-expo. Para interceptar `fetch` no RN em testes, o polyfill de `fetch` do jest-expo já é suficiente; não precisa de service worker (isso era do ambiente browser do web).

---

## 4. Padrões de teste

### 4.1 Teste de componente isolado

```tsx
// src/components/ui/button.test.tsx
import { render, screen, userEvent } from "@testing-library/react-native";
import { Button } from "./button";

test("renders with children", () => {
  render(<Button>Salvar</Button>);
  expect(screen.getByRole("button", { name: /salvar/i })).toBeOnTheScreen();
});

test("calls onPress", async () => {
  const onPress = jest.fn();
  const user = userEvent.setup();
  render(<Button onPress={onPress}>Salvar</Button>);
  await user.press(screen.getByRole("button", { name: /salvar/i }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test("respects disabled", async () => {
  const onPress = jest.fn();
  const user = userEvent.setup();
  render(<Button onPress={onPress} disabled>Salvar</Button>);
  await user.press(screen.getByRole("button", { name: /salvar/i }));
  expect(onPress).not.toHaveBeenCalled();
});
```

### 4.2 Teste de componente que consome hook do Kubb

Crie um wrapper de teste que provê QueryClient (+ i18n, se não estiver no setup global). **Aqui criamos um QueryClient novo por teste de propósito** — em produção há um único global (ver [`STATE.md`](./STATE.md)), mas testes precisam de cache vazio, `retry: false` e `gcTime: 0`.

```tsx
// test/utils/render.tsx
import { render as rntlRender } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";

export function renderWithProviders(ui: ReactElement, opts?: { queryClient?: QueryClient }) {
  const queryClient = opts?.queryClient ?? new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { ...rntlRender(ui, { wrapper: Wrapper }), queryClient };
}
```

```tsx
// src/components/users/users-list.test.tsx
import { screen } from "@testing-library/react-native";
import { renderWithProviders } from "@/test/utils/render";
import { UsersList } from "./users-list";

test("renders list of users", async () => {
  renderWithProviders(<UsersList filters={{ page: 1 }} />);
  expect(await screen.findByText("Alice")).toBeOnTheScreen();
  expect(screen.getByText("Bob")).toBeOnTheScreen();
});

test("shows skeleton while loading", () => {
  renderWithProviders(<UsersList filters={{ page: 1 }} />);
  expect(screen.getByLabelText(/carregando/i)).toBeOnTheScreen();
});
```

### 4.3 Teste de form

```tsx
import { screen, userEvent } from "@testing-library/react-native";
import { renderWithProviders } from "@/test/utils/render";
import { UserForm } from "./user-form";

test("validates required fields", async () => {
  const onSubmit = jest.fn();
  const user = userEvent.setup();
  renderWithProviders(<UserForm onSubmit={onSubmit} />);
  await user.press(screen.getByRole("button", { name: /salvar/i }));
  expect(await screen.findByText(/nome é obrigatório/i)).toBeOnTheScreen();
  expect(onSubmit).not.toHaveBeenCalled();
});

test("submits valid form", async () => {
  const onSubmit = jest.fn();
  const user = userEvent.setup();
  renderWithProviders(<UserForm onSubmit={onSubmit} />);

  await user.type(screen.getByLabelText(/nome/i), "Alice");
  await user.type(screen.getByLabelText(/e-mail/i), "alice@test.com");
  await user.press(screen.getByRole("button", { name: /salvar/i }));

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ name: "Alice", email: "alice@test.com" }),
  );
});
```

> Em RN, campos são `TextInput` com `accessibilityLabel`; `getByLabelText` os encontra. `user.type` dispara `onChangeText`.

### 4.4 Override de handler MSW em teste específico

```tsx
import { server } from "@/test/mocks/server";
import { http, HttpResponse } from "msw";

test("shows error on 500", async () => {
  server.use(
    http.get("*/users", () => HttpResponse.json(
      { error: { code: "INTERNAL", message: "boom" } },
      { status: 500 },
    )),
  );

  renderWithProviders(<UsersList filters={{ page: 1 }} />);
  expect(await screen.findByText(/erro ao carregar/i)).toBeOnTheScreen();
});
```

---

## 5. Queries do RNTL — qual usar quando

Em ordem de preferência (do mais "como usuário" para o mais "implementação"):

| Query | Quando usar |
|---|---|
| `getByRole` | **Default.** `button`, `link`, `header`, `text`, `image` (via `accessibilityRole`) |
| `getByLabelText` | Campos e ícones com `accessibilityLabel` |
| `getByPlaceholderText` | `TextInput` com placeholder |
| `getByText` | Texto visível na tela |
| `getByDisplayValue` | `TextInput` com valor |
| `getByTestId` | **Último recurso.** Componentes sem semântica acessível. |

**Variantes:** `getBy*` (síncrono, falha se não acha), `queryBy*` (null se não acha — asserção de ausência), `findBy*` (async, espera aparecer), `*all*` (múltiplos).

```tsx
// ✅
screen.getByRole("button", { name: /salvar/i });
await screen.findByText("Usuário criado");
expect(screen.queryByText(/carregando/i)).not.toBeOnTheScreen();

// ❌ frágil; quebra ao refatorar a árvore
screen.getByTestId("btn-primary");
```

---

## 6. userEvent vs fireEvent

**Prefira `userEvent`.** Simula interação humana (foco, sequência de eventos). `fireEvent` dispara um evento cru — use quando `userEvent` não cobre o gesto.

```ts
import { userEvent, fireEvent } from "@testing-library/react-native";

const user = userEvent.setup();
await user.press(button);              // toque completo
await user.type(input, "Hello");       // dispara onChangeText por char

fireEvent.press(button);               // evento cru (sem foco/sequência)
fireEvent.changeText(input, "Hello");  // seta valor direto
fireEvent.scroll(list, { nativeEvent: { contentOffset: { y: 400 } } });
```

> `render`, `userEvent` e `fireEvent` já vêm embrulhados em `act()` — **não** embrulhe de novo.

---

## 7. Acessibilidade nos testes

Se você consegue testar via `getByRole`/`getByLabelText`, seu app é navegável por leitor de tela (VoiceOver/TalkBack). Se você se viu usando `getByTestId` demais, **isso é sinal** de que a UI pode estar inacessível — adicione `accessibilityRole`/`accessibilityLabel` (ver [`CODING_STANDARDS.md` §7](./CODING_STANDARDS.md)).

---

## 8. Cobertura

Cobertura via `jest --coverage`. **Sem thresholds enforçados** hoje — a meta de equipe é ~75% lines / 70% branches. `src/api/generated/**` fica de fora (código gerado).

**Não persiga 100%.** 80% bem feito > 100% com testes inúteis.

---

## 9. Maestro para E2E

E2E em simulador/emulador (ou device) com fluxos declarativos em YAML sob `.maestro/`.

### 9.1 Instalar

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

### 9.2 Estrutura de um flow

```yaml
# .maestro/users-create.yaml
appId: com.empresa.financeapp
---
- launchApp:
    clearState: true
- assertVisible: "Entrar"          # tela de login (grupo (auth))
# Em E2E rodamos com EXPO_PUBLIC_ENV=test (fixtures) OU login real via Google + backend (§9.4)
- tapOn: "Entrar"
- assertVisible:
    id: "tab-users"
- tapOn:
    id: "tab-users"
- assertVisible: "Novo usuário"
- tapOn: "Novo usuário"
- tapOn: "Nome"
- inputText: "Alice"
- tapOn: "E-mail"
- inputText: "alice@test.com"
- tapOn: "Salvar"
- assertVisible: "Alice"
```

> `appId` = o `android.package` / `ios.bundleIdentifier` do `app.json`. Comandos: `launchApp`, `tapOn`, `inputText`, `assertVisible`, `scroll`, `runFlow`. `tapOn` aceita texto (o `accessibilityLabel`/label visível), `id` (o `testID`) ou regex.

**Filosofia idêntica ao RNTL:** o Maestro acha elementos por texto / accessibility. Faça o app acessível e os fluxos ficam legíveis.

### 9.3 O que cobrir em E2E

**Sim:** login (Google ou bypass de test), fluxo "criar X" ponta-a-ponta, navegação entre tabs críticas, reabrir o app com sessão, logout.

**Não:** validação de cada campo (cobre em Jest/RNTL), cada combinação de filtros, erro 500 de cada endpoint.

**Regra:** 10-15 flows focados em **jornadas**, não em **detalhes**.

### 9.4 Auth em E2E

Duas estratégias:

**A) Bypass com `EXPO_PUBLIC_ENV=test`** (rápido, padrão): build/serve o app com `EXPO_PUBLIC_ENV=test` — o `AuthProvider` injeta `TEST_AUTH` e `isAuthenticated()`/`getJwtToken()` retornam fixtures (ver [`AUTH.md` §9](./AUTH.md#9-test-mode-e2e-e-dev-sem-backendgoogle)). O guard `<Stack.Protected>` já libera o grupo `(tabs)`.

**B) Login real via Google + backend staging** (mais realista, mais frágil): o flow abre o fluxo nativo do Google; automatizar isso no Maestro exige interagir com a tela de conta do Google. Reserve para um único smoke test.

### 9.5 Comandos

```bash
maestro test .maestro/                       # roda todos os flows
maestro test .maestro/users-create.yaml      # um flow
maestro test -e APP_ID=com.empresa.financeapp .maestro/   # parametrizado
maestro studio                               # inspeciona a árvore de UI ao vivo
```

> No `package.json`: `"test:e2e": "maestro test .maestro/"`.

---

## 10. CI

```
Stage 1 (paralelo, ~3 min):
  - expo lint
  - typecheck
  - jest (com coverage)

Stage 2 (~10-15 min):
  - build de preview (EAS / dev client) + maestro test .maestro/ em emulador
```

Em PR, falha em Stage 1 bloqueia merge. Stage 2 (Maestro) roda os fluxos críticos.

---

## 11. Testes para evitar

- **Snapshot tests** — gigantes, frágeis, ninguém lê. Só para outputs estáveis.
- **Tests de implementação** — "chamou `setState` 3 vezes". Quebra ao refatorar.
- **Testes de bibliotecas** — não teste que o RN renderiza. Teste seu código.

---

## 12. Padrões anti-flake

1. **Sempre `await user.*`** — interações são async.
2. **`findBy` para dados async**, não `getBy` com timeout.
3. **`waitFor` raramente** — só quando não há um elemento aparecendo/sumindo claro.
4. **MSW handler determinístico** — sem `Math.random`.
5. **Sem `setTimeout` em testes** — use waiting expressivo do RNTL.
6. **`server.resetHandlers()` entre testes** (já no setup).
7. **No Maestro,** confie no auto-wait; evite `waitForAnimationToEnd` desnecessário.

---

## 13. Checklist de testes

- [ ] Componente novo tem teste em mesma pasta (Jest + RNTL)
- [ ] Usa `renderWithProviders` se consome hooks do Kubb
- [ ] MSW handler em `test/mocks/handlers.ts`
- [ ] Queries via `getByRole` / `getByLabelText` (não `testId` se possível)
- [ ] `userEvent` para interações; `fireEvent` só quando necessário
- [ ] Casos: happy path, validação, erro de API
- [ ] Sem `act()` manual (RNTL cuida)
- [ ] Sem `waitFor` arbitrário; use `findBy`
- [ ] Fluxo crítico tem flow Maestro em `.maestro/*.yaml`
