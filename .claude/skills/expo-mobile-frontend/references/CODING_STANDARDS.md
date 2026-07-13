# CODING_STANDARDS.md — Padrões de Código (app mobile)

> Padrões obrigatórios para todo PR. Lista curta porque o resto é coberto por ESLint (`expo lint`) + tsconfig strict + tipos do Kubb.

---

## 1. TypeScript

### 1.1 `tsconfig.json` base

Estende o base do Expo (que já traz `jsx: react-jsx`, `moduleResolution: Bundler` e os tipos de RN — **sem DOM libs**):

```jsonc
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "useUnknownInCatchVariables": true,
    "exactOptionalPropertyTypes": true,

    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "resolveJsonModule": true,

    "noEmit": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src", "test", "expo-env.d.ts", "nativewind-env.d.ts"],
  "exclude": ["node_modules"]
}
```

> Sem `"DOM"`/`"DOM.Iterable"` em `lib` — este é um runtime **React Native**, não browser. `nativewind-env.d.ts` habilita a prop `className` nos componentes RN.

### 1.2 Regras de TS

- **Sem `any`.** Use `unknown` + narrowing. Regra `no-explicit-any` ativa.
- **`noUncheckedIndexedAccess`** — `array[0]` é `T | undefined`. Trate explicitamente.
- **`useUnknownInCatchVariables`** — `catch (err)` é `unknown`. Use type guards (`if (err instanceof ApiError)`).
- **Sem `as` casual.** Permitido só em: narrowing após verificação; const assertions (`as const`); params de rota tipados (`useLocalSearchParams<{ id: string }>()`).
- **Sem `// @ts-ignore`.** Use `// @ts-expect-error` com comentário do porquê.
- **Tipos vêm do Kubb** para tudo de API. Sem digitar shape de response à mão.

---

## 2. Naming

| Item | Convenção | Exemplo |
|---|---|---|
| Variáveis, funções, props | camelCase | `userId`, `onPress` |
| Componentes React | PascalCase | `UserForm`, `UsersList` |
| Tipos, interfaces, enums | PascalCase | `type User`, `enum Role` |
| Constantes globais | UPPER_SNAKE_CASE | `MAX_FILE_SIZE`, `API_TIMEOUT` |
| Arquivos de componente | kebab-case.tsx | `user-form.tsx` (exporta `UserForm`) |
| Arquivos de hook | kebab-case (prefixo `use-`) | `use-debounce.ts` |
| Arquivos utilitários | kebab-case | `format-date.ts` |
| Pastas | kebab-case | `components/users/`, `hooks/users/` |
| Schemas Zod (variáveis) | camelCase + sufixo `Schema` | `createUserSchema` |
| Tipos derivados de schema | PascalCase | `type CreateUserInput = z.infer<...>` |

> **Exceção Expo Router:** arquivos em `src/app/` seguem a convenção de rota do Expo (`index.tsx`, `[id].tsx`, `(tabs)/`, `+not-found.tsx`) e usam **`export default`** para a tela. Fora de `src/app/`, named exports.

**Booleanos com prefixo:** `is*` (`isOpen`, `isLoading`), `has*` (`hasAccess`), `should*` (`shouldRetry`), `can*` (`canEdit`).

**Event handlers:** prefixo `handle*` no nome local, `on*` na prop (`onPress`, `onChangeText`).

```tsx
function UserForm({ onSubmit }: Props) {
  const handleSubmit = (values: UserInput) => onSubmit(values);
  // ...
}
```

---

## 3. Imports — ordem e estilo

ESLint (`expo lint`) checa; mantenha a ordem:

1. `node:*` builtins (raro)
2. Dependências externas (`react`, `react-native`, `expo-router`, `@tanstack/*`, `zod`)
3. Aliases `@/*` (seu código)
4. Imports relativos `./`, `../`
5. Imports type-only ao final

```tsx
import { View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { useCreateUser } from "@/api/generated/hooks/usersHooks/useCreateUser";

import { UserRow } from "./user-row";

import type { User } from "@/api/generated/types";
```

**Regras:**
- **Sempre `import type`** quando o import é só pra tipo (`verbatimModuleSyntax` força isso).
- **Sem `import *`** exceto namespaces justificados (`import * as SecureStore from "expo-secure-store"`, `import * as Sentry from "@sentry/react-native"`).
- **Sem default imports** de libs que oferecem named.
- Prefira **caminhos absolutos** `@/...`; relativos só para irmãos diretos.

---

## 4. Componentes React Native

### 4.1 Estilo

```tsx
// ✅ função declarada (não arrow expression)
export function UserCard({ user }: Props) {
  return (
    <View>
      <Text>{user.name}</Text>
    </View>
  );
}

// ✅ default export apenas em telas do Expo Router (src/app/*). Caso contrário, named exports.
```

**Por que function declaration:** stack traces, fast refresh e mais fácil de identificar no debugger.

**Primitivos RN, nunca DOM.** `View`/`Text`/`Pressable`/`ScrollView`/`FlatList`; imagens via `expo-image` (`<Image>` do `expo-image`, com `contentFit`/`blurhash`), **nunca** `<img>` nem o `<Image>` cru do RN em telas de produto. Nada de `div`/`span`/`button`/`onClick`.

### 4.2 Props

```tsx
type Props = {
  user: User;
  onEdit?: (id: string) => void;
  className?: string;              // NativeWind
};

export function UserCard({ user, onEdit, className }: Props) {
  // ...
}
```

- **Type alias `Props`** (não `interface`). Consistência com tipos do Kubb (que usa `type`).
- **Sem `React.FC`** — não tipa `children` bem.
- **`children` explícito** se aceito: `children: ReactNode`.

### 4.3 Estilo com NativeWind

- **`className`** para todo estilo. `cn()` (de `@/lib/utils`) para merge condicional.
- **Sem `StyleSheet.create`** salvo caso justificado (perf de lista, animação Reanimated).
- **Dark mode** via classes `dark:` + `useColorScheme`. Ver [`STYLING.md`](./STYLING.md).

### 4.4 Componente vs hook vs util

- **Componente:** retorna JSX (árvore RN).
- **Hook:** começa com `use*`, usa outros hooks ou retorna stateful logic.
- **Util:** função pura, sem hooks. Em `src/lib/` ou no módulo.

---

## 5. Segurança

### 5.1 Conteúdo não confiável

- **Sem renderizar HTML/JS arbitrário.** Se precisar exibir HTML remoto, use `react-native-webview` isolado — nunca injete conteúdo não confiável.
- **React escapa por default** — interpolar texto em `<Text>` é seguro.
- **Deep links são entrada não confiável.** Valide params de deep link antes de navegar (Zod). Nunca use um param de link cru como destino de `router.push()` sem checar que é uma rota interna conhecida.

### 5.2 Tokens e dados sensíveis

- **Access/refresh JWT no `expo-secure-store`** (Keychain/Keystore) — nunca `AsyncStorage` nem `useState` ([`AUTH.md`](./AUTH.md)).
- **Nunca** logar tokens, senhas, números de cartão.
- **Não confie em claims JWT** no client para autorização — só para UX (mostrar nome/e-mail). Backend é fonte da verdade (autoriza por posse do dado).

### 5.3 Dependências

- **Lockfile commitado** (`pnpm-lock.yaml`).
- `pnpm audit` no CI falha em high/critical.
- Antes de adicionar lib nativa nova, verifique: mantida? compatível com Expo SDK 57 (config plugin / prebuild)? sem vulnerabilidades?

---

## 6. Logging

### 6.1 Em dev

`console.log` só durante debug local, mas **remova** antes do PR. ESLint sinaliza (`no-console`).

### 6.2 Em prod

- **Erros:** capturados por `@sentry/react-native` (crashes nativos + JS + `captureException` manual).
- **Eventos de produto:** `posthog.capture(...)`.
- **Sem `console.log` em PR.** Ver [`OBSERVABILITY.md`](./OBSERVABILITY.md).
- **Não logue PII** (e-mails, IDs de usuário em texto livre).

---

## 7. Acessibilidade (a11y) — mínimo obrigatório

- **Elemento interativo tem `accessibilityRole`** (`button`, `link`, `header`, `image`) e **`accessibilityLabel`** quando o texto visível não basta.
- **Botão de ícone sem texto** tem `accessibilityLabel`.
- **Alvos de toque ≥ 44pt** (largura e altura). Use `hitSlop` quando o visual for menor.
- **Cor não é único significante.** Status de erro: cor + ícone + texto.
- **Suporte a fonte grande do sistema** (Dynamic Type / font scaling) — evite altura fixa que corta texto.
- **Contraste AA**: 4.5:1 texto normal, 3:1 texto grande/UI.
- **Estado comunicado** via `accessibilityState` (`disabled`, `selected`, `checked`).

```tsx
<Pressable
  accessibilityRole="button"
  accessibilityLabel={t("users.actions.delete")}
  accessibilityState={{ disabled: isPending }}
  hitSlop={8}
  onPress={onDelete}
>
  <TrashIcon />
</Pressable>
```

> Sem Lighthouse (é ferramenta web). Valide a11y com VoiceOver (iOS) / TalkBack (Android) e com os queries `getByRole`/`getByLabelText` do @testing-library/react-native ([`TESTING.md`](./TESTING.md)).

---

## 8. Performance — mínimo no PR

- **Sem `useState` redundante para dados da API.**
- **Listas longas com `FlatList`/`FlashList`** (`keyExtractor` estável — ID, não index; itens memoizados). Nunca `.map()` em `ScrollView`.
- **Imagens via `expo-image`** com `contentFit` e dimensões definidas (evita layout shift).
- **Animação na UI thread** (Reanimated worklets), não `Animated` do core em hot paths.
- **Lazy nas telas pesadas** — o Expo Router já faz split por rota; evite import estático de libs pesadas fora da tela que usa.

Targets e checklist completo em [`PERFORMANCE.md`](./PERFORMANCE.md).

---

## 9. Comentários

- **Evite comentário óbvio.** Código auto-explicativo > comentário.
- **JSDoc para utilitários públicos** (`/** ... */`) — editor mostra na hover.
- **`// TODO(jira-id):`** com referência. Sem TODOs órfãos.
- **`// HACK:`** com explicação do porquê e como remover.

---

## 10. Git & PR

### 10.1 Branches

```
main           → produção (protected, requer PR + 1 approval + CI passing)
develop        → staging (protected, mesma regra)
feature/<jira>-<slug>
fix/<jira>-<slug>
chore/<slug>
```

### 10.2 Commits

[Conventional Commits](https://www.conventionalcommits.org):

```
feat(users): add pull-to-refresh to users list
fix(auth): handle google sign-in cancel
chore(deps): bump expo to SDK 57
refactor(forms): extract zod schema to module
docs: update ARCHITECTURE.md
test(users): add edge cases for list filters
```

### 10.3 PR

- Título: igual a commit conventional (`feat(users): ...`).
- Descrição com **o quê / por quê / como testei** (inclua device/simulador testado).
- Screenshots/gravação para mudanças visuais (iOS **e** Android quando divergirem).
- Link pro Jira/Linear.
- < 400 linhas mudadas idealmente. PRs grandes = quebre.

### 10.4 Hooks de Git

`simple-git-hooks` + `lint-staged`:

```json
// package.json
{
  "simple-git-hooks": {
    "pre-commit": "pnpm lint-staged",
    "pre-push": "pnpm typecheck"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix"]
  }
}
```

---

## 11. Definition of Done — checklist do PR

Antes de marcar como pronto para review:

- [ ] **Funcional:** atende ao critério de aceitação do ticket (testado em iOS **e** Android)
- [ ] **Tipado:** sem `any`, sem `@ts-ignore`, build limpo (`pnpm typecheck`)
- [ ] **Lint:** `pnpm lint` (expo lint) passa sem warnings
- [ ] **Testado:**
  - [ ] Componente novo tem teste de integração (Jest + @testing-library/react-native + MSW)
  - [ ] Mutation crítica tem teste de erro + sucesso
  - [ ] Se for fluxo crítico (login, criar X), tem E2E Maestro (`.maestro/*.yaml`)
- [ ] **RN, não DOM:** `View`/`Text`/`Pressable`/`FlatList`; imagens via `expo-image`; sem `div`/`onClick`/`<img>`
- [ ] **Acessibilidade:** `accessibilityRole`/`accessibilityLabel` em interativos, alvos ≥ 44pt, testado com VoiceOver/TalkBack
- [ ] **Estilo:** NativeWind `className`; dark mode via `dark:` + `useColorScheme`
- [ ] **i18n:**
  - [ ] Nenhuma string visível hardcoded (tudo via `t("chave")` ou `<Trans>`)
  - [ ] Chaves novas adicionadas no JSON do namespace certo
  - [ ] Datas/moedas via `useFormat()`, não `.toLocaleDateString()` direto
- [ ] **Datas/timezone:**
  - [ ] Datas formatadas via `useFormat()` (timezone do device via expo-localization)
  - [ ] Forms enviam `Date.toISOString()` (UTC); recebem strings ISO do backend
  - [ ] Sem `new Date("YYYY-MM-DD")` (interpretado como UTC) — ver [`DATES.md`](./DATES.md)
  - [ ] Testes com data usam `TZ=UTC` + `jest.setSystemTime()`
- [ ] **Autorização:** acesso é só por autenticação (guard `<Stack.Protected>`) — **sem** papéis/personas/`useCan`/`<Can>` (ver [`PERMISSIONS.md`](./PERMISSIONS.md)); 403 do backend vira toast inline (não logout)
- [ ] **Uploads (se aplicável):**
  - [ ] Usa o fluxo de presigned URL (`expo-image-picker`/`expo-document-picker` → PUT) com `UPLOAD_LIMITS` ([`UPLOADS.md`](./UPLOADS.md))
  - [ ] Bucket S3 com CORS pro app
  - [ ] Progress + cancel visíveis para arquivos > 1 MB
- [ ] **Observabilidade:**
  - [ ] Eventos de produto importantes têm `posthog.capture("event_name", {...})`
  - [ ] Erros de operações críticas têm `Sentry.captureException` com tags relevantes
  - [ ] PII marcado com máscara de replay se visível ([`OBSERVABILITY.md`](./OBSERVABILITY.md))
- [ ] **Segurança:**
  - [ ] Sem token logado/exibido; tokens só em `expo-secure-store`
  - [ ] Params de deep link validados antes de navegar
  - [ ] Inputs validados (Zod no boundary)
- [ ] **UX:**
  - [ ] Loading states (skeleton, não spinner em containers)
  - [ ] Error states (mensagem útil, retry quando aplicável)
  - [ ] Empty states (quando lista vazia)
  - [ ] Toast em mutations
- [ ] **Docs:** se mudou pattern, atualizou o `.md` relevante
- [ ] **Sem `console.log`** e **sem TODOs órfãos** sem referência a ticket

---

## 12. Scripts no repo

Se precisar de script (gerar OpenAPI manualmente, fixture seeder), faça em **TypeScript** rodando via `tsx`, não bash. Mais portável, type-safe, debugável.

```ts
// scripts/seed-msw-fixtures.ts
import { writeFile } from "node:fs/promises";
// ...
await writeFile("test/mocks/fixtures.json", JSON.stringify(data, null, 2));
```

```json
{ "scripts": { "seed:fixtures": "tsx scripts/seed-msw-fixtures.ts" } }
```
