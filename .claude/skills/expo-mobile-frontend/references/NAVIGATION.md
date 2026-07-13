# NAVIGATION.md — Expo Router (file-based routing)

> **Rotas são arquivos.** Cada arquivo em `src/app/` vira uma rota; a estrutura de pastas **é** a árvore de navegação. Sem tabela de rotas manual, sem `React Navigation` cru configurado à mão — o Expo Router monta o navigator a partir do file system e cuida de deep links nativos. É o análogo mobile do file-based routing do TanStack Router no front web (ver [`../SKILL.md`](../SKILL.md) §2 para o porquê de Expo Router).
>
> Confira a doc versionada do Expo SDK 57 antes de usar APIs de rota — https://docs.expo.dev/versions/v57.0.0/. Typed routes e `Stack.Protected` mudaram entre versões.

---

## 1. Modelo mental

- **Arquivo = rota.** `src/app/users/index.tsx` → `/users`.
- **Pasta = segmento.** `src/app/users/[id].tsx` → `/users/:id`.
- **`_layout.tsx` = navigator** daquele nível (envolve as rotas irmãs num `<Stack>`, `<Tabs>`, etc.).
- **Grupos `(nome)/`** organizam sem virar segmento de URL (ver §3).
- **`+not-found.tsx`** = fallback 404.
- Ponto de entrada: `"main": "expo-router/entry"` no `package.json`; rotas moram em `src/app/` (não `src/routes/`).

---

## 2. Estrutura de rotas do projeto

```
src/app/
├── _layout.tsx             # root layout: providers (Query, Auth, i18n) + <Stack> + guard de auth
├── index.tsx               # / (redireciona conforme auth)
├── (auth)/                 # grupo NÃO-autenticado
│   ├── _layout.tsx
│   └── sign-in.tsx         # /sign-in
├── (tabs)/                 # grupo AUTENTICADO com tab bar
│   ├── _layout.tsx         # <Tabs>
│   ├── index.tsx           # / (home autenticada)
│   └── users/
│       ├── index.tsx       # /users
│       └── [id].tsx        # /users/:id  → useLocalSearchParams()
└── +not-found.tsx
```

O prefixo dos grupos (`(auth)`, `(tabs)`) **não** aparece na URL — `/sign-in`, `/users`, `/users/123`.

---

## 3. Grupos `(auth)` e `(tabs)`

Grupos servem para **agrupar rotas sob um layout comum** sem afetar a URL. Aqui separam os dois mundos do app:

- **`(auth)/`** — telas acessíveis **sem** login (sign-in com Google). Layout simples (`<Stack>` sem tab bar).
- **`(tabs)/`** — telas **pós-login**, sob uma tab bar (`<Tabs>`).

### 3.1 Layout de tabs

```tsx
// src/app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="index" options={{ title: t("nav:home") }} />
      <Tabs.Screen name="users" options={{ title: t("nav:users") }} />
    </Tabs>
  );
}
```

### 3.2 Layout de stack (auth)

```tsx
// src/app/(auth)/_layout.tsx
import { Stack } from "expo-router";

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

---

## 4. Params dinâmicos — `[id].tsx`

Colchetes no nome do arquivo criam um segmento dinâmico. Leia o valor com **`useLocalSearchParams()`**:

```tsx
// src/app/(tabs)/users/[id].tsx
import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useGetUser } from "@/api/generated";

export default function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: user } = useGetUser(id);

  return (
    <View className="p-4">
      <Text className="text-lg font-medium text-foreground">{user?.name}</Text>
    </View>
  );
}
```

- **Catch-all:** `[...slug].tsx` → `slug` é `string[]`.
- Com typed routes (§6), o param pode ser tipado a partir do literal da rota:
  ```tsx
  const { id } = useLocalSearchParams<"/users/[id]">();
  ```

---

## 5. Navegar entre telas

### 5.1 `<Link>` (declarativo)

```tsx
import { Link } from "expo-router";
import { Text } from "react-native";

// href estático
<Link href="/users"><Text>Ver usuários</Text></Link>

// href dinâmico com params (typed)
<Link href={{ pathname: "/users/[id]", params: { id: user.id } }}>
  <Text>{user.name}</Text>
</Link>
```

Para envolver um componente próprio (ex.: um `Button`/`Pressable`), use **`asChild`**:

```tsx
import { Link } from "expo-router";
import { Button } from "@/components/ui/button";

<Link href="/users" asChild>
  <Button label="Ver usuários" />
</Link>;
```

### 5.2 `useRouter()` (imperativo)

```tsx
import { useRouter } from "expo-router";

function CreateUserButton() {
  const router = useRouter();
  return (
    <Button
      label="Novo"
      onPress={() => router.push({ pathname: "/users/[id]", params: { id: "new" } })}
    />
  );
}
```

- **`router.push(...)`** — empilha nova tela (fica no histórico).
- **`router.replace(...)`** — troca sem empilhar (não volta pra ela).
- **`router.back()`** — volta.
- **`router.setParams(...)`** — muda params da tela atual.

### 5.3 `<Redirect>` (redirecionamento declarativo)

```tsx
// src/app/index.tsx
import { Redirect } from "expo-router";
import { useAuth } from "@/contexts/auth-context";

export default function Index() {
  const { isLoggedIn, isLoading } = useAuth();
  if (isLoading) return null; // ou splash
  return <Redirect href={isLoggedIn ? "/(tabs)" : "/(auth)/sign-in"} />;
}
```

---

## 6. Typed routes

Ligadas no `app.json`:

```json
// app.json
{
  "expo": {
    "experiments": { "typedRoutes": true }
  }
}
```

Com typed routes, o Expo Router **gera** os tipos das rotas a partir do file system. `href`, `router.push`, `params` e `useLocalSearchParams` passam a ser type-safe — uma rota inexistente ou um param faltando viram erro de compilação. Regenera junto com `expo start`/`tsc`. Combina com o pilar de type-safety ponta-a-ponta ([`../SKILL.md`](../SKILL.md) §1).

---

## 7. Auth guard — `<Stack.Protected guard={...}>`

O guard de auth mora no **root `_layout.tsx`**, não em `beforeLoad` (isso é TanStack Router web). `<Stack.Protected guard={...}>` envolve as telas de um mundo: quando `guard` é **`false`**, aquelas telas ficam **inacessíveis** e o router navega para a próxima rota disponível. Telas **fora** do guard (sign-in) continuam acessíveis quando `guard` é falso.

**Mudança do `guard` re-renderiza o layout e navega automaticamente** — ao logar, `isLoggedIn` vira `true`, as telas `(tabs)` ficam acessíveis e o router leva o usuário pra lá; ao deslogar, o caminho inverso. Sem navegação imperativa espalhada.

```tsx
// src/app/_layout.tsx
import "../../global.css";

import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { queryClient } from "@/api/query-client";
import { useHydrateColorScheme } from "@/hooks/common/use-color-scheme";

function RootNavigator() {
  const { isLoggedIn } = useAuth();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isLoggedIn}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="(auth)/sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  useHydrateColorScheme();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

**Notas:**
- O `<Stack.Protected>` precisa estar **dentro** do provider de auth (`useAuth()` deve resolver antes).
- Enquanto o auth está carregando (`isLoading`), mostre splash/loader — não decida o guard com estado indefinido.
- Detalhes de login (Google Sign-In → JWT do backend, tokens em `expo-secure-store`, `forceLogout`) em [`AUTH.md`](./AUTH.md). **Não há autorização por papel** — autenticado vê o app inteiro ([`PERMISSIONS.md`](./PERMISSIONS.md)).

---

## 8. Header, título e opções por tela

```tsx
// dentro de uma tela
import { Stack } from "expo-router";

export default function UsersScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Usuários" }} />
      {/* ... conteúdo ... */}
    </>
  );
}
```

Ou centralize no `_layout.tsx` via `<Stack.Screen name="..." options={...} />`. Strings de título passam por `t()` ([`I18N.md`](./I18N.md)) — nada hardcoded.

---

## 9. Deep links

O `scheme` do app (`app.json` → `"scheme": "financeapp"`) mapeia URLs `financeapp://users/123` para a rota `/users/[id]`. Como as rotas vêm do file system, deep links funcionam sem configuração extra de parsing. (O login com Google usa o SDK nativo `@react-native-google-signin`, que devolve o `idToken` direto — não depende desse deep link; ver [`AUTH.md`](./AUTH.md).)

---

## 10. Checklist de navegação

- [ ] Rota nova é um arquivo em `src/app/` (não tabela manual)
- [ ] Segmento dinâmico com `[id].tsx`; valor lido via `useLocalSearchParams()`
- [ ] Grupos `(auth)`/`(tabs)` para separar mundos sem sujar a URL
- [ ] `_layout.tsx` define o navigator (`<Stack>`/`<Tabs>`) do nível
- [ ] Navegação com `<Link href>` / `router.push()` / `<Redirect>` — nunca URL crua sem tipo
- [ ] Typed routes ligado (`experiments.typedRoutes` no `app.json`)
- [ ] Guard de auth com `<Stack.Protected guard={isLoggedIn}>` no root `_layout`, dentro do `AuthProvider`
- [ ] Loader/splash enquanto `isLoading` do auth
- [ ] Títulos e labels via `t()` ([`I18N.md`](./I18N.md))
- [ ] `<Link asChild>` ao usar um componente próprio como alvo de navegação
