# PERMISSIONS.md — Autorização (sem papéis/personas)

> **Este projeto NÃO tem autorização por papel.** Não existem personas, roles, catálogo de permissões, `useCan`, `<Can>`, nem claim `authorities`. O único portão é **autenticação**: ou o usuário está logado (via Google → JWT do backend, ver [`AUTH.md`](./AUTH.md)) ou não está.

> **Leia também:** [`AUTH.md`](./AUTH.md) (JWT próprio + Google Sign-In), [`NAVIGATION.md`](./NAVIGATION.md) (guard de auth) e a raiz [`../SKILL.md`](../SKILL.md).

---

## 1. Modelo de autorização

1. **Autenticação é o único gate no app.** O guard `<Stack.Protected guard={isAuthenticated}>` no `_layout.tsx` decide: sem sessão → grupo `(auth)` (login); com sessão → grupo `(tabs)` (app inteiro). Não há tela "escondida por papel".
2. **Backend é a autoridade sobre os dados.** O acesso a um recurso é decidido no backend **por posse/escopo** (o usuário só vê/edita os próprios registros — ex.: as próprias transações), não por um papel embutido no token. O JWT carrega só identidade (`sub`/`email`/`name`).
3. **Sem catálogo de permissões no app.** Não há `src/lib/permissions/`, `PERMISSIONS.*`, `parsePermissionsFromToken`, `usePermissions`, `useCan`, `useCanAny`, `<Can>` nem `persona-groups.ts`. Se você encontrar referência a isso em algum doc antigo, é resíduo — ignore.
4. **`useAuth()` não expõe `permissions`.** O `AuthState` é `{ user, isLoading, isAuthenticated }` (ver [`AUTH.md` §4.1](./AUTH.md#41-authcontext)).

---

## 2. Como gate por autenticação

Já é automático via o guard do Expo Router — qualquer tela dentro de `(tabs)` exige sessão. Não é preciso checar nada por tela.

```tsx
// dentro de (tabs) o usuário já está autenticado — só use os dados dele
import { useAuth } from "@/contexts/auth-context";

function ProfileScreen() {
  const { user } = useAuth();          // user != null aqui (o guard garantiu)
  return <Text>{user?.name}</Text>;
}
```

Se precisar reagir a "expirou a sessão", isso é tratado pelo `401 → forceLogout()` no client de API ([`AUTH.md` §5](./AUTH.md#5-integração-com-a-api-client-wrapper)).

---

## 3. Erros de autorização vindos do backend

Como o backend autoriza por posse do dado, um recurso de outro usuário volta **404** (não existe pra você) ou **403**. Trate o 403 como feedback inline, não como logout:

```ts
if (res.status === 403) {
  const body = await res.json().catch(() => ({}));
  Toast.show({ type: "error", text1: t("errors.forbidden") });
  throw new ApiError(403, body.code ?? "FORBIDDEN", body.message);
}
```

**Não confunda com 401.** 401 = sessão inválida/expirada → `forceLogout()`. 403 = autenticado mas o backend negou aquele recurso → toast inline.

---

## 4. Se um dia precisar de papéis

Não invente um sistema de permissões só no app. Se o produto passar a exigir papéis (ex.: "admin da família" vs "membro"):

1. Backend vira a fonte da verdade — emite os papéis no JWT (ou expõe num `GET /me`).
2. Só então reintroduza um catálogo tipado no app + um hook de checagem, **pareado** com o backend.
3. Abra ADR nova em [`DECISIONS.md`](./DECISIONS.md) registrando a decisão.

Até lá: **autenticado = autorizado no app; o backend restringe por posse do dado.**

---

## 5. Checklist

- [ ] Nenhum `src/lib/permissions/`, `useCan`, `<Can>`, `PERMISSIONS.*` ou `usePermissions` no código
- [ ] `AuthState` = `{ user, isLoading, isAuthenticated }` (sem `permissions`)
- [ ] JWT do backend carrega só identidade (sem claim `authorities`)
- [ ] Gate de acesso = guard de auth (`<Stack.Protected>`), não checagem por papel
- [ ] 403 do backend vira toast inline (não `forceLogout`); 401 → `forceLogout`
