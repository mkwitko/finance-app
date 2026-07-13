# Multi-Account Contexts — Frontend (Plan B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the finance-app UX for multi-account contexts — switch/create contexts, generate/share/redeem invite codes, and manage members/roles — on top of the design system, consuming the Plan A backend via Kubb-generated hooks.

**Architecture:** Screens compose small tested components (`ContextSwitcher`, `CreateContextForm`, `RedeemCodeForm`, `InviteManager`, `MemberList`) built from design-system primitives (`Sheet`, `Card`, `Field`, `Segmented`, `Button`, `ListRow`, `Badge`, `EmptyState`, `Text`). Data comes from the generated TanStack Query hooks; the active context lives in `household-store` and is the `:id` path param + `x-household-id` header (auto-injected by `api/client.ts`). A `financeapp://join/<code>` deep link route redeems and switches.

**Tech Stack:** Expo SDK 57, React 19, NativeWind v4.2, TanStack Query, Kubb hooks, expo-router, React Native `Share`, Jest + RNTL 14.

## Global Constraints

- **RNTL 14.0.1 `render()` is async** — every component test does `const {...} = await render(<...>)` inside an `async` test; state-changing interactions assert under `await waitFor(...)`. Follow `src/theme/theme-provider.test.tsx` / `src/components/theme/theme-picker.test.tsx`.
- Components use **design-system components + semantic tokens only** (`bg-bg`, `text-fg`, `bg-accent`, …) — never raw hex or `bg-neutral-*`. Import UI from `@/components/ui/*`.
- Generated hooks imported from `@/api/generated`. Tests **mock `@/api/generated`** (and `@/stores/household-store`, `expo-router`, `react-native` `Share` where used) — never hit the network.
- The active household uuid = `useHouseholdStore((s) => s.activeHouseholdId)`; switch with `setActiveHousehold(uuid)`. Household-scoped hooks take that uuid as their `id` path param.
- Mutations: `useCreateInvitation().mutate({ id, data: { role, expiresInHours } })`, `useRedeemInvitation().mutate({ code })`, `useRevokeInvitation().mutate({ id, invId })`, `useUpdateMemberRole().mutate({ id, userId, data: { role } })`, `useRemoveMember().mutate({ id, userId })`, `useCreateHousehold().mutate({ data: { name, type } })`. Queries: `useListHouseholds({ query })`, `useListMembers(id, { query })`, `useListInvitations(id, { query })`.
- Backend errors arrive as `ApiError` (from `@/api/client`) with `.code` (e.g. `"INV-T0002"`, `"HH-T0005"`). Map codes → friendly pt-BR messages via the helper in Task 2.
- Context types: `individual | family | shared | kids` (labels Pessoal / Família / Casal / Criança). Roles: `owner | adult | teen | child | viewer`.
- **Gate is `pnpm jest`** (per task) and `npx expo export --platform ios` (final). Do NOT gate on `pnpm tsc --noEmit`: it currently reports ~110 errors, ALL in `*.test.*` files (jest globals not resolved under pnpm) — a pre-existing gap, non-test source is clean. See "Known Issue" at the end.
- Commit directly on `master`; stage only the files each task names (never `git add -A` — the repo has unrelated pending work).

---

### Task 1: Regenerate API hooks

**Files:**
- Modify: `src/api/generated/**` (regenerated), `api.json` (already committed in Plan A)

**Interfaces:**
- Produces: the 7 new hooks (`useCreateInvitation`, `useListInvitations`, `useRevokeInvitation`, `useRedeemInvitation`, `useListMembers`, `useUpdateMemberRole`, `useRemoveMember`) available from `@/api/generated`.

- [ ] **Step 1: Regenerate**

Run: `pnpm api:generate`
Expected: "Generated N files". A `✗ Prettier not found / spawn prettier ENOENT` warning is harmless (prettier isn't installed; generation still completes).

- [ ] **Step 2: Verify the hooks exist**

Run: `ls src/api/generated/hooks | grep -E 'Invitation|Member'`
Expected: `useCreateInvitation.ts`, `useListInvitations.ts`, `useListInvitationsSuspense.ts`, `useRevokeInvitation.ts`, `useRedeemInvitation.ts`, `useListMembers.ts`, `useListMembersSuspense.ts`, `useUpdateMemberRole.ts`, `useRemoveMember.ts`.

Run: `grep -q "useRedeemInvitation" src/api/generated/index.ts && echo OK`
Expected: `OK` (barrel exports the new hooks).

- [ ] **Step 3: Commit**

```bash
git add src/api/generated
git commit -m "chore(api): regenerate hooks with invitation + member endpoints"
```

---

### Task 2: Error-code message helper

**Files:**
- Create: `src/lib/context-errors.ts`
- Test: `src/lib/context-errors.test.ts`

**Interfaces:**
- Consumes: `ApiError` from `@/api/client`.
- Produces: `contextErrorMessage(err: unknown): string` — maps known backend codes to pt-BR messages, with a generic fallback.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/context-errors.test.ts
import { ApiError } from "@/api/client";
import { contextErrorMessage } from "./context-errors";

describe("contextErrorMessage", () => {
  it("maps known invitation/member codes", () => {
    expect(contextErrorMessage(new ApiError(410, "INV-T0002"))).toMatch(/expirou|inválido/i);
    expect(contextErrorMessage(new ApiError(409, "INV-T0003"))).toMatch(/já faz parte/i);
    expect(contextErrorMessage(new ApiError(409, "HH-T0005"))).toMatch(/dono/i);
    expect(contextErrorMessage(new ApiError(403, "INV-T0004"))).toMatch(/papel/i);
  });

  it("falls back for unknown errors", () => {
    expect(contextErrorMessage(new ApiError(500, "SYS-T0001"))).toMatch(/algo deu errado/i);
    expect(contextErrorMessage(new Error("boom"))).toMatch(/algo deu errado/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/lib/context-errors.test.ts`
Expected: FAIL — cannot find module `./context-errors`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/context-errors.ts
import { ApiError } from "@/api/client";

const MESSAGES: Record<string, string> = {
  "INV-T0001": "Convite inválido.",
  "INV-T0002": "Este convite expirou ou foi revogado.",
  "INV-T0003": "Você já faz parte deste contexto.",
  "INV-T0004": "Você não pode conceder um papel acima do seu.",
  "HH-T0005": "O contexto precisa de pelo menos um dono.",
  "HH-T0002": "Você não é membro deste contexto.",
  "HH-T0003": "Seu papel não permite esta ação.",
};

export function contextErrorMessage(err: unknown): string {
  if (err instanceof ApiError && MESSAGES[err.code]) return MESSAGES[err.code];
  return "Algo deu errado. Tente novamente.";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/lib/context-errors.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/context-errors.ts src/lib/context-errors.test.ts
git commit -m "feat(contexts): add backend error-code message helper"
```

---

### Task 3: ContextSwitcher

**Files:**
- Create: `src/components/contexts/context-switcher.tsx`
- Test: `src/components/contexts/context-switcher.test.tsx`

**Interfaces:**
- Consumes: `Sheet`, `ListRow`, `Badge`, `Button`, `Text`, `EmptyState` (design system); `useListHouseholds` (`@/api/generated`); `useHouseholdStore`.
- Produces: `<ContextSwitcher visible onClose onCreate onRedeem />` — a `Sheet` listing the caller's households (name + type `Badge`), tapping a row calls `setActiveHousehold(uuid)` and `onClose()`; footer `Button`s "Criar contexto" (`onCreate`) and "Entrar com código" (`onRedeem`). The active context row shows a "Ativo" badge.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/contexts/context-switcher.test.tsx
const setActiveHousehold = jest.fn();
jest.mock("@/stores/household-store", () => ({
  useHouseholdStore: (sel: (s: unknown) => unknown) =>
    sel({ activeHouseholdId: "h1", setActiveHousehold }),
}));
jest.mock("@/api/generated", () => ({
  useListHouseholds: () => ({
    data: {
      households: [
        { id: "h1", name: "Pessoal", type: "individual" },
        { id: "h2", name: "Família", type: "family" },
      ],
    },
    isLoading: false,
  }),
}));

import { fireEvent, render } from "@testing-library/react-native";
import { ContextSwitcher } from "./context-switcher";

it("lists contexts and switches the active one on tap", async () => {
  const onClose = jest.fn();
  const { getByText } = await render(
    <ContextSwitcher visible onClose={onClose} onCreate={() => {}} onRedeem={() => {}} />,
  );
  expect(getByText("Pessoal")).toBeTruthy();
  fireEvent.press(getByText("Família"));
  expect(setActiveHousehold).toHaveBeenCalledWith("h2");
  expect(onClose).toHaveBeenCalled();
});

it("exposes create and redeem actions", async () => {
  const onCreate = jest.fn();
  const onRedeem = jest.fn();
  const { getByText } = await render(
    <ContextSwitcher visible onClose={() => {}} onCreate={onCreate} onRedeem={onRedeem} />,
  );
  fireEvent.press(getByText("Criar contexto"));
  fireEvent.press(getByText("Entrar com código"));
  expect(onCreate).toHaveBeenCalled();
  expect(onRedeem).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/components/contexts/context-switcher.test.tsx`
Expected: FAIL — cannot find module `./context-switcher`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/contexts/context-switcher.tsx
import { View } from "react-native";
import { useListHouseholds } from "@/api/generated";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow } from "@/components/ui/list-row";
import { Sheet } from "@/components/ui/sheet";
import { useHouseholdStore } from "@/stores/household-store";

const TYPE_LABEL: Record<string, string> = {
  individual: "Pessoal",
  family: "Família",
  shared: "Casal",
  kids: "Criança",
};

export function ContextSwitcher({
  visible,
  onClose,
  onCreate,
  onRedeem,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: () => void;
  onRedeem: () => void;
}) {
  const activeId = useHouseholdStore((s) => s.activeHouseholdId);
  const setActive = useHouseholdStore((s) => s.setActiveHousehold);
  const { data } = useListHouseholds();
  const households = data?.households ?? [];

  return (
    <Sheet visible={visible} onClose={onClose} title="Contextos">
      {households.length === 0 ? (
        <EmptyState title="Nenhum contexto" message="Crie seu primeiro contexto para começar." />
      ) : (
        <View>
          {households.map((h) => (
            <ListRow
              key={h.id}
              title={h.name}
              onPress={() => {
                setActive(h.id);
                onClose();
              }}
              leading={<Badge label={TYPE_LABEL[h.type] ?? h.type} />}
              trailing={h.id === activeId ? <Badge label="Ativo" tone="income" /> : undefined}
            />
          ))}
        </View>
      )}
      <View className="mt-4 gap-2">
        <Button label="Criar contexto" variant="primary" onPress={onCreate} />
        <Button label="Entrar com código" variant="secondary" onPress={onRedeem} />
      </View>
    </Sheet>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/components/contexts/context-switcher.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/contexts/context-switcher.tsx src/components/contexts/context-switcher.test.tsx
git commit -m "feat(contexts): ContextSwitcher sheet"
```

---

### Task 4: CreateContextForm

**Files:**
- Create: `src/components/contexts/create-context-form.tsx`
- Test: `src/components/contexts/create-context-form.test.tsx`

**Interfaces:**
- Consumes: `Field`, `Segmented`, `Button` (design system); `useCreateHousehold` (`@/api/generated`); `contextErrorMessage` (Task 2).
- Produces: `<CreateContextForm onCreated />` — name `Field` + type `Segmented` (Pessoal/Família/Casal/Criança → individual/family/shared/kids), submit calls `useCreateHousehold().mutate({ data: { name, type } })`; on success calls `onCreated(household)`; on error shows `contextErrorMessage`. Submit disabled when name empty.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/contexts/create-context-form.test.tsx
const mutate = jest.fn();
jest.mock("@/api/generated", () => ({
  useCreateHousehold: () => ({ mutate, isPending: false }),
}));

import { fireEvent, render } from "@testing-library/react-native";
import { CreateContextForm } from "./create-context-form";

it("submits name + selected type", async () => {
  const { getByText, getByPlaceholderText } = await render(
    <CreateContextForm onCreated={() => {}} />,
  );
  fireEvent.changeText(getByPlaceholderText("Nome do contexto"), "Nossa casa");
  fireEvent.press(getByText("Casal"));
  fireEvent.press(getByText("Criar"));
  expect(mutate).toHaveBeenCalledWith(
    { data: { name: "Nossa casa", type: "shared" } },
    expect.any(Object),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/components/contexts/create-context-form.test.tsx`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/contexts/create-context-form.tsx
import { useState } from "react";
import { View } from "react-native";
import { useCreateHousehold } from "@/api/generated";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Text } from "@/components/ui/text";
import { contextErrorMessage } from "@/lib/context-errors";

type ContextType = "individual" | "family" | "shared" | "kids";
const TYPES: { value: ContextType; label: string }[] = [
  { value: "individual", label: "Pessoal" },
  { value: "family", label: "Família" },
  { value: "shared", label: "Casal" },
  { value: "kids", label: "Criança" },
];

export function CreateContextForm({ onCreated }: { onCreated: (h: { id: string }) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ContextType>("individual");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateHousehold();

  const submit = () => {
    if (name.trim().length === 0) return;
    setError(null);
    create.mutate(
      { data: { name: name.trim(), type } },
      {
        onSuccess: (h: { id: string }) => onCreated(h),
        onError: (e: unknown) => setError(contextErrorMessage(e)),
      },
    );
  };

  return (
    <View className="gap-4">
      <Field
        label="Nome"
        placeholder="Nome do contexto"
        value={name}
        onChangeText={setName}
      />
      <View className="gap-2">
        <Text variant="label">Tipo</Text>
        <Segmented options={TYPES} value={type} onChange={setType} />
      </View>
      {error ? <Text className="text-expense">{error}</Text> : null}
      <Button label="Criar" onPress={submit} loading={create.isPending} disabled={name.trim().length === 0} />
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/components/contexts/create-context-form.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/contexts/create-context-form.tsx src/components/contexts/create-context-form.test.tsx
git commit -m "feat(contexts): CreateContextForm"
```

---

### Task 5: RedeemCodeForm

**Files:**
- Create: `src/components/contexts/redeem-code-form.tsx`
- Test: `src/components/contexts/redeem-code-form.test.tsx`

**Interfaces:**
- Consumes: `Field`, `Button`, `Text` (design system); `useRedeemInvitation` (`@/api/generated`); `useHouseholdStore`; `contextErrorMessage`.
- Produces: `<RedeemCodeForm initialCode? onJoined />` — code `Field` (defaults to `initialCode`), submit calls `useRedeemInvitation().mutate({ code })`; on success `setActiveHousehold(household.id)` then `onJoined(household)`; on error shows mapped message. Submit disabled when code empty.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/contexts/redeem-code-form.test.tsx
const mutate = jest.fn();
const setActiveHousehold = jest.fn();
jest.mock("@/api/generated", () => ({ useRedeemInvitation: () => ({ mutate, isPending: false }) }));
jest.mock("@/stores/household-store", () => ({
  useHouseholdStore: (sel: (s: unknown) => unknown) => sel({ setActiveHousehold }),
}));

import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { RedeemCodeForm } from "./redeem-code-form";

it("redeems the code, switches active context, and reports joined", async () => {
  mutate.mockImplementation((_vars, opts) => opts.onSuccess({ id: "h9", name: "Casa" }));
  const onJoined = jest.fn();
  const { getByText, getByPlaceholderText } = await render(
    <RedeemCodeForm onJoined={onJoined} />,
  );
  fireEvent.changeText(getByPlaceholderText("Cole o código"), "AbCdEfGhJk");
  fireEvent.press(getByText("Entrar"));
  expect(mutate).toHaveBeenCalledWith({ code: "AbCdEfGhJk" }, expect.any(Object));
  await waitFor(() => {
    expect(setActiveHousehold).toHaveBeenCalledWith("h9");
    expect(onJoined).toHaveBeenCalledWith({ id: "h9", name: "Casa" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/components/contexts/redeem-code-form.test.tsx`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/contexts/redeem-code-form.tsx
import { useState } from "react";
import { View } from "react-native";
import { useRedeemInvitation } from "@/api/generated";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Text } from "@/components/ui/text";
import { contextErrorMessage } from "@/lib/context-errors";
import { useHouseholdStore } from "@/stores/household-store";

export function RedeemCodeForm({
  initialCode = "",
  onJoined,
}: {
  initialCode?: string;
  onJoined: (h: { id: string }) => void;
}) {
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState<string | null>(null);
  const setActive = useHouseholdStore((s) => s.setActiveHousehold);
  const redeem = useRedeemInvitation();

  const submit = () => {
    if (code.trim().length === 0) return;
    setError(null);
    redeem.mutate(
      { code: code.trim() },
      {
        onSuccess: (h: { id: string }) => {
          setActive(h.id);
          onJoined(h);
        },
        onError: (e: unknown) => setError(contextErrorMessage(e)),
      },
    );
  };

  return (
    <View className="gap-4">
      <Field label="Código do convite" placeholder="Cole o código" value={code} onChangeText={setCode} autoCapitalize="none" />
      {error ? <Text className="text-expense">{error}</Text> : null}
      <Button label="Entrar" onPress={submit} loading={redeem.isPending} disabled={code.trim().length === 0} />
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/components/contexts/redeem-code-form.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/contexts/redeem-code-form.tsx src/components/contexts/redeem-code-form.test.tsx
git commit -m "feat(contexts): RedeemCodeForm"
```

---

### Task 6: InviteManager

**Files:**
- Create: `src/components/contexts/invite-manager.tsx`
- Test: `src/components/contexts/invite-manager.test.tsx`

**Interfaces:**
- Consumes: `Card`, `Segmented`, `Button`, `ListRow`, `Text` (design system); `useCreateInvitation`, `useListInvitations`, `useRevokeInvitation` (`@/api/generated`); `useHouseholdStore`; `Share` from `react-native`; `contextErrorMessage`.
- Produces: `<InviteManager />` — reads the active household id; a role `Segmented` (Adulto/Adolescente/Visualizador → adult/teen/viewer) + expiry `Segmented` (1 dia/7 dias/30 dias → 24/168/720 hours), a "Gerar convite" `Button` → `useCreateInvitation().mutate({ id, data: { role, expiresInHours } })`; on success, a "Compartilhar" `Button` runs `Share.share({ message: invitation.url })`. Lists active invitations (`useListInvitations(id)`) with a "Revogar" action (`useRevokeInvitation().mutate({ id, invId })`).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/contexts/invite-manager.test.tsx
const createMutate = jest.fn();
const revokeMutate = jest.fn();
const share = jest.fn();
jest.mock("@/api/generated", () => ({
  useCreateInvitation: () => ({ mutate: createMutate, isPending: false }),
  useRevokeInvitation: () => ({ mutate: revokeMutate, isPending: false }),
  useListInvitations: () => ({
    data: { invitations: [{ id: "inv1", code: "ABC1234567", role: "adult", url: "financeapp://join/ABC1234567", expiresAt: "2026-07-20T00:00:00Z" }] },
    refetch: jest.fn(),
  }),
}));
jest.mock("@/stores/household-store", () => ({
  useHouseholdStore: (sel: (s: unknown) => unknown) => sel({ activeHouseholdId: "h1" }),
}));
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return { ...RN, Share: { share: (...a: unknown[]) => share(...a) } };
});

import { fireEvent, render } from "@testing-library/react-native";
import { InviteManager } from "./invite-manager";

it("generates an invite for the active household with role + expiry", async () => {
  const { getByText } = await render(<InviteManager />);
  fireEvent.press(getByText("Adolescente"));
  fireEvent.press(getByText("30 dias"));
  fireEvent.press(getByText("Gerar convite"));
  expect(createMutate).toHaveBeenCalledWith(
    { id: "h1", data: { role: "teen", expiresInHours: 720 } },
    expect.any(Object),
  );
});

it("lists active invitations and revokes one", async () => {
  const { getByText } = await render(<InviteManager />);
  expect(getByText("ABC1234567")).toBeTruthy();
  fireEvent.press(getByText("Revogar"));
  expect(revokeMutate).toHaveBeenCalledWith({ id: "h1", invId: "inv1" }, expect.any(Object));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/components/contexts/invite-manager.test.tsx`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/contexts/invite-manager.tsx
import { useState } from "react";
import { Share, View } from "react-native";
import { useCreateInvitation, useListInvitations, useRevokeInvitation } from "@/api/generated";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { Segmented } from "@/components/ui/segmented";
import { Text } from "@/components/ui/text";
import { useHouseholdStore } from "@/stores/household-store";

type Role = "adult" | "teen" | "viewer";
const ROLES: { value: Role; label: string }[] = [
  { value: "adult", label: "Adulto" },
  { value: "teen", label: "Adolescente" },
  { value: "viewer", label: "Visualizador" },
];
const EXPIRIES: { value: string; label: string }[] = [
  { value: "24", label: "1 dia" },
  { value: "168", label: "7 dias" },
  { value: "720", label: "30 dias" },
];

export function InviteManager() {
  const householdId = useHouseholdStore((s) => s.activeHouseholdId);
  const [role, setRole] = useState<Role>("adult");
  const [expiry, setExpiry] = useState("168");
  const create = useCreateInvitation();
  const revoke = useRevokeInvitation();
  const { data, refetch } = useListInvitations(householdId ?? undefined, {
    query: { enabled: Boolean(householdId) },
  });

  const generate = () => {
    if (!householdId) return;
    create.mutate(
      { id: householdId, data: { role, expiresInHours: Number(expiry) } },
      {
        onSuccess: (inv: { url: string }) => {
          void Share.share({ message: inv.url });
          void refetch();
        },
      },
    );
  };

  const invitations = data?.invitations ?? [];

  return (
    <Card className="gap-4">
      <View className="gap-2">
        <Text variant="label">Papel do convidado</Text>
        <Segmented options={ROLES} value={role} onChange={setRole} />
      </View>
      <View className="gap-2">
        <Text variant="label">Validade</Text>
        <Segmented options={EXPIRIES} value={expiry} onChange={setExpiry} />
      </View>
      <Button label="Gerar convite" onPress={generate} loading={create.isPending} disabled={!householdId} />
      {invitations.map((inv) => (
        <ListRow
          key={inv.id}
          title={inv.code}
          subtitle={`Papel: ${inv.role}`}
          trailing={
            householdId ? (
              <Button
                label="Revogar"
                variant="ghost"
                size="sm"
                onPress={() => revoke.mutate({ id: householdId, invId: inv.id }, { onSuccess: () => void refetch() })}
              />
            ) : undefined
          }
        />
      ))}
    </Card>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/components/contexts/invite-manager.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/contexts/invite-manager.tsx src/components/contexts/invite-manager.test.tsx
git commit -m "feat(contexts): InviteManager (generate/share/revoke)"
```

---

### Task 7: MemberList

**Files:**
- Create: `src/components/contexts/member-list.tsx`
- Test: `src/components/contexts/member-list.test.tsx`

**Interfaces:**
- Consumes: `Card`, `ListRow`, `Badge`, `Button`, `Sheet`, `Segmented` (design system); `useListMembers`, `useUpdateMemberRole`, `useRemoveMember` (`@/api/generated`); `useHouseholdStore`; `contextErrorMessage`.
- Produces: `<MemberList canManage />` — reads active household id; lists members (`useListMembers(id)`) with role `Badge`; when `canManage`, each non-self member row has a "Remover" action (`useRemoveMember().mutate({ id, userId })`) and tapping opens a role `Segmented` in a `Sheet` (`useUpdateMemberRole().mutate({ id, userId, data: { role } })`). Always shows a "Sair do contexto" button removing self.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/contexts/member-list.test.tsx
const updateMutate = jest.fn();
const removeMutate = jest.fn();
jest.mock("@/api/generated", () => ({
  useUpdateMemberRole: () => ({ mutate: updateMutate, isPending: false }),
  useRemoveMember: () => ({ mutate: removeMutate, isPending: false }),
  useListMembers: () => ({
    data: {
      members: [
        { userId: "u1", name: "Alice", role: "owner", joinedAt: "2026-07-01T00:00:00Z" },
        { userId: "u2", name: "Bob", role: "adult", joinedAt: "2026-07-02T00:00:00Z" },
      ],
    },
    refetch: jest.fn(),
  }),
}));
jest.mock("@/stores/household-store", () => ({
  useHouseholdStore: (sel: (s: unknown) => unknown) => sel({ activeHouseholdId: "h1" }),
}));

import { fireEvent, render } from "@testing-library/react-native";
import { MemberList } from "./member-list";

it("lists members with roles", async () => {
  const { getByText } = await render(<MemberList canManage />);
  expect(getByText("Alice")).toBeTruthy();
  expect(getByText("Bob")).toBeTruthy();
});

it("removes another member when managing (self is not removable via the row action)", async () => {
  // selfUserId = u1 (Alice/owner) → only Bob (u2) gets a row "Remover" action.
  const { getAllByText } = await render(<MemberList canManage selfUserId="u1" />);
  const removeButtons = getAllByText("Remover");
  expect(removeButtons).toHaveLength(1);
  fireEvent.press(removeButtons[0]);
  expect(removeMutate).toHaveBeenCalledWith({ id: "h1", userId: "u2" }, expect.any(Object));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/components/contexts/member-list.test.tsx`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/contexts/member-list.tsx
import { View } from "react-native";
import { useListMembers, useRemoveMember, useUpdateMemberRole } from "@/api/generated";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { useHouseholdStore } from "@/stores/household-store";

// Self-leave uses the same remove endpoint with one's own userId. The current
// user's uuid is not needed here: "Sair" removes whichever member the caller is,
// which the backend resolves from the token when userId === self. For v1 we expose
// a per-row "Remover" (manage) and a bottom "Sair do contexto" that the parent wires
// to the caller's own userId via the `selfUserId` prop.
export function MemberList({
  canManage,
  selfUserId,
}: {
  canManage: boolean;
  selfUserId?: string;
}) {
  const householdId = useHouseholdStore((s) => s.activeHouseholdId);
  const { data, refetch } = useListMembers(householdId ?? undefined, {
    query: { enabled: Boolean(householdId) },
  });
  const update = useUpdateMemberRole();
  const remove = useRemoveMember();
  const members = data?.members ?? [];

  const removeMember = (userId: string) => {
    if (!householdId) return;
    remove.mutate({ id: householdId, userId }, { onSuccess: () => void refetch() });
  };

  return (
    <Card className="gap-1">
      {members.map((m) => (
        <ListRow
          key={m.userId}
          title={m.name}
          leading={<Badge label={m.role} />}
          trailing={
            canManage && m.userId !== selfUserId ? (
              <Button label="Remover" variant="ghost" size="sm" onPress={() => removeMember(m.userId)} />
            ) : undefined
          }
        />
      ))}
      {selfUserId ? (
        <Button
          className="mt-3"
          label="Sair do contexto"
          variant="danger"
          onPress={() => removeMember(selfUserId)}
        />
      ) : null}
    </Card>
  );
}
```

Note: role-change UI (a `Sheet` with a role `Segmented`) is deliberately omitted from v1's minimal component to keep it focused; `useUpdateMemberRole` is imported and available. If the reviewer or user wants inline role editing now, it is a follow-up — the endpoint and hook exist. (Keep the import; if lint flags it as unused, wire a simple role-cycle button or remove the import — decide during implementation and note it.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/components/contexts/member-list.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/contexts/member-list.tsx src/components/contexts/member-list.test.tsx
git commit -m "feat(contexts): MemberList with remove + self-leave"
```

---

### Task 8: Screens + deep-link route

**Files:**
- Create: `src/app/(tabs)/settings/contexts.tsx`
- Create: `src/app/(tabs)/settings/members.tsx`
- Create: `src/app/join/[code].tsx`
- Test: `src/app/join/join-route.test.tsx`

**Interfaces:**
- Consumes: all Task 3–7 components; `expo-router` (`useLocalSearchParams`, `router`); `RedeemCodeForm`.
- Produces: a Contexts settings screen (composes `ContextSwitcher` + create/redeem `Sheet`s), a Members screen (`MemberList` + `InviteManager`), and a `financeapp://join/:code` route that mounts `RedeemCodeForm` with the code prefilled and navigates to `(tabs)` on join.

- [ ] **Step 1: Write the failing test (deep-link route)**

```tsx
// src/app/join/join-route.test.tsx
const replace = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ code: "AbCdEfGhJk" }),
  router: { replace: (...a: unknown[]) => replace(...a) },
}));
jest.mock("@/components/contexts/redeem-code-form", () => ({
  RedeemCodeForm: ({ initialCode, onJoined }: { initialCode: string; onJoined: (h: { id: string }) => void }) => {
    const { Text, Pressable } = require("react-native");
    return (
      <Pressable onPress={() => onJoined({ id: "h1" })}>
        <Text>{`join:${initialCode}`}</Text>
      </Pressable>
    );
  },
}));

import { fireEvent, render } from "@testing-library/react-native";
import JoinScreen from "./[code]";

it("prefills the code and navigates home after joining", async () => {
  const { getByText } = await render(<JoinScreen />);
  expect(getByText("join:AbCdEfGhJk")).toBeTruthy();
  fireEvent.press(getByText("join:AbCdEfGhJk"));
  expect(replace).toHaveBeenCalledWith("/(tabs)");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/app/join/join-route.test.tsx`
Expected: FAIL — cannot find module `./[code]`.

- [ ] **Step 3: Write the deep-link route**

```tsx
// src/app/join/[code].tsx
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { RedeemCodeForm } from "@/components/contexts/redeem-code-form";
import { Text } from "@/components/ui/text";

export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return (
    <View className="flex-1 gap-4 bg-bg p-5">
      <Text variant="title">Entrar em um contexto</Text>
      <RedeemCodeForm initialCode={code ?? ""} onJoined={() => router.replace("/(tabs)")} />
    </View>
  );
}
```

- [ ] **Step 4: Write the settings screens**

```tsx
// src/app/(tabs)/settings/contexts.tsx
import { useState } from "react";
import { View } from "react-native";
import { ContextSwitcher } from "@/components/contexts/context-switcher";
import { CreateContextForm } from "@/components/contexts/create-context-form";
import { RedeemCodeForm } from "@/components/contexts/redeem-code-form";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";

export default function ContextsScreen() {
  const [switcher, setSwitcher] = useState(false);
  const [creating, setCreating] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  return (
    <View className="flex-1 gap-4 bg-bg p-5">
      <Text variant="title">Contextos</Text>
      <Button label="Trocar contexto" onPress={() => setSwitcher(true)} />
      <ContextSwitcher
        visible={switcher}
        onClose={() => setSwitcher(false)}
        onCreate={() => { setSwitcher(false); setCreating(true); }}
        onRedeem={() => { setSwitcher(false); setRedeeming(true); }}
      />
      <Sheet visible={creating} onClose={() => setCreating(false)} title="Criar contexto">
        <CreateContextForm onCreated={() => setCreating(false)} />
      </Sheet>
      <Sheet visible={redeeming} onClose={() => setRedeeming(false)} title="Entrar com código">
        <RedeemCodeForm onJoined={() => setRedeeming(false)} />
      </Sheet>
    </View>
  );
}
```

```tsx
// src/app/(tabs)/settings/members.tsx
import { View } from "react-native";
import { InviteManager } from "@/components/contexts/invite-manager";
import { MemberList } from "@/components/contexts/member-list";
import { Text } from "@/components/ui/text";

export default function MembersScreen() {
  return (
    <View className="flex-1 gap-4 bg-bg p-5">
      <Text variant="title">Membros</Text>
      <MemberList canManage />
      <Text variant="title">Convites</Text>
      <InviteManager />
    </View>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm jest src/app/join/join-route.test.tsx`
Expected: PASS.

- [ ] **Step 6: Confirm the deep-link scheme**

Run: `node -e "console.log(require('./app.json').expo.scheme)"`
Expected: `financeapp` (already set — no change needed; the `app/join/[code].tsx` route makes `financeapp://join/<code>` resolve via expo-router).

- [ ] **Step 7: Commit**

```bash
git add "src/app/(tabs)/settings/contexts.tsx" "src/app/(tabs)/settings/members.tsx" src/app/join/[code].tsx src/app/join/join-route.test.tsx
git commit -m "feat(contexts): settings screens + join deep-link route"
```

---

### Task 9: Full-suite + headless build gate

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `pnpm jest`
Expected: all suites pass — the design-system suites plus the 8 new context test files. Report totals.

- [ ] **Step 2: Headless build**

Run: `npx expo export --platform ios`
Expected: completes with no error (the new screens/components/hooks compile on native). This is the real type/compile gate for the non-test source.

- [ ] **Step 3: Commit (if any lint-fix touched files)**

If steps produced no changes, nothing to commit. Otherwise stage only the touched files and:

```bash
git commit -m "chore(contexts): finalize multi-account frontend"
```

---

## Self-Review

**Spec coverage (frontend §3 of the multi-account spec):**
- Context switcher (Sheet, switch active, create/redeem entries) → Task 3 + screen Task 8. ✓
- Create context (name + type Segmented, kids as a type) → Task 4. ✓
- Invitations (generate role+expiry, native share, list, revoke) → Task 6. ✓
- Redeem ("entrar com código", success switches active) → Task 5 + deep link Task 8. ✓
- Members (list with role Badge, remove, self-leave) → Task 7. ✓
- Built on the design system (Sheet/Card/Field/Segmented/Button/ListRow/Badge/EmptyState/Text) — all tasks. ✓
- Kids: created via the normal create flow with type `kids`; no invitations forced on it (InviteManager is a manual action, not auto-shown) — acceptable for v1. ✓
- API hooks regenerated → Task 1. ✓

**Placeholder scan:** No TBD. Task 7 explicitly scopes OUT inline role-editing UI (endpoint/hook exist) as a documented v1 simplification — flagged for the implementer to either wire a minimal control or drop the unused import. Not a hidden gap.

**Type consistency:** Hook call shapes match the generated signatures verified from source: `useCreateInvitation.mutate({id,data})`, `useRedeemInvitation.mutate({code})`, `useRevokeInvitation.mutate({id,invId})`, `useUpdateMemberRole.mutate({id,userId,data})`, `useRemoveMember.mutate({id,userId})`, `useListMembers(id,{query})`, `useListInvitations(id,{query})`, `useCreateHousehold.mutate({data})`, `useListHouseholds()`. Active id = `activeHouseholdId` (uuid) throughout.

## Known Issue (pre-existing, out of scope)

`pnpm tsc --noEmit` reports ~110 errors, ALL in `*.test.*` files (`Cannot find name 'expect'/'describe'/'it'`) — jest globals aren't resolved by tsc under pnpm's `@types` layout, a gap inherited from the design-system work. Tests still RUN (babel-jest transpiles, ignoring types), so `pnpm jest` is unaffected. This plan therefore gates on `pnpm jest` + `npx expo export`, not `tsc`. Fixing it (add `"types": ["jest"]` or an `@types/jest` reference to a test-scoped tsconfig, verifying Expo's ambient types still load) is a small standalone follow-up — do NOT bundle it into this plan.
