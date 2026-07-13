# Statement Import Wizard — Frontend (Plan B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the crude paste-textarea import with a guided multi-step wizard (account → source + per-bank instructions → file → review → result) with a fixed-footer CTA, consuming Plan A's `preview`/`commit` endpoints.

**Architecture:** A single `ImportWizard` component drives a step state machine and renders the current step's body above a shared `WizardFooter`. File selection goes through a `pickStatement` helper (expo-document-picker + expo-file-system `File.text()`). Review uses `ReviewRow` + a `CategoryPickerSheet`. Per-bank guidance is static data. Reachable via an "Importar extrato" button on the transactions screen (the old paste box is removed).

**Tech Stack:** Expo SDK 57, React 19, NativeWind v4.2, TanStack Query, Kubb hooks, expo-document-picker (~57), expo-file-system (~57, to add), Jest + RNTL 14.

## Global Constraints

- **RNTL 14.0.1 `render()` is async** — `const {...} = await render(<...>)`; interactions asserting post-state under `await waitFor(...)`. Follow `src/components/theme/theme-picker.test.tsx`.
- **No test files under `src/app/`** (Expo Router bundles them as routes → breaks `expo export`). Component tests co-locate under `src/components/`; a route test goes at `src/<name>.test.tsx`.
- Design-system components + semantic tokens only (`bg-bg`, `text-fg`, `text-expense`, `bg-accent`, …) — no raw hex/`bg-neutral-*`. UI from `@/components/ui/*`.
- Hooks from `@/api/generated`; tests mock `@/api/generated`, `@/stores/household-store`, `expo-document-picker`, `expo-file-system`. Mutations: `usePreviewImport().mutate({ data })`, `useCommitImport().mutate({ data })`. Queries `useListAccounts({query})`, `useListCategories({query})` → `{ accounts:[{id,name,kind}] }` / `{ categories:[{id,name,kind}] }` (id = uuid). Active household via `useHouseholdStore` is auto-injected as `x-household-id` by the api client.
- **Preview/commit contract (Plan A):** `preview` body `{ source, accountId(uuid), content }` → `{ rows: PreviewRow[] }` where `PreviewRow = { amountCents, direction, occurredAt(ISO), description, rawRef, suggestedCategory: string|null, confidence, duplicate }`. `commit` body `{ accountId(uuid), source, rows: CommitRow[] }` where `CommitRow = { amountCents, direction, occurredAt, description, rawRef, categoryName: string|null }` → `{ importId, imported, skipped }`. **Commit REQUIRES `source`.**
- **Expo file read (SDK 57):** `DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: [...] })` → `result.canceled` / `result.assets[0].{uri,name}`; then `await new File(uri).text()` from `expo-file-system` (the legacy `readAsStringAsync` is deprecated and throws — do NOT use it).
- Amount is always positive cents; sign is `direction`. Money rendered via `AmountText` using signed cents (`direction === "out" ? -amountCents : amountCents`).
- **Gate is `pnpm jest`** + `npx expo export --platform ios` exit 0. NOT `tsc`.
- Commit on `master`; stage only the files each task names (never `git add -A`).

---

### Task 1: Regenerate hooks + add expo-file-system

**Files:** Modify `src/api/generated/**`, `package.json`, `pnpm-lock.yaml`.

- [ ] **Step 1: Regenerate** — `pnpm api:generate` (prettier warning harmless). Verify `ls src/api/generated/hooks | grep -iE 'Preview|Commit'` → `usePreviewImport.ts`, `useCommitImport.ts`.
- [ ] **Step 2: Add expo-file-system** — `pnpm add expo-file-system@~57.0.0` (align to SDK 57; if that exact range errors, use the version `npx expo install expo-file-system` resolves — prefer `npx expo install expo-file-system` which picks the SDK-correct version). Verify `node -e "console.log(require('./package.json').dependencies['expo-file-system'])"` prints a version.
- [ ] **Step 3: Commit** — `git add src/api/generated package.json pnpm-lock.yaml && git commit -m "chore: regenerate hooks + add expo-file-system for import wizard"`.

---

### Task 2: Per-bank import guides

**Files:**
- Create: `src/constants/bank-import-guides.ts`
- Test: `src/constants/bank-import-guides.test.ts`

**Interfaces:**
- Produces: `type BankGuide = { id: string; label: string; emoji: string; ofxSteps: string[]; csvSteps: string[] }`; `BANK_GUIDES: BankGuide[]` (nubank, itau, bradesco, inter, c6, bb, caixa, generic); `getBankGuide(id: string): BankGuide` (falls back to the `generic` guide).

- [ ] **Step 1: Write the failing test**

```ts
// src/constants/bank-import-guides.test.ts
import { BANK_GUIDES, getBankGuide } from "./bank-import-guides";

it("includes the major banks + a generic fallback", () => {
  const ids = BANK_GUIDES.map((g) => g.id);
  for (const id of ["nubank", "itau", "bradesco", "inter", "c6", "bb", "caixa", "generic"]) {
    expect(ids).toContain(id);
  }
});

it("every guide has non-empty ofx + csv steps", () => {
  for (const g of BANK_GUIDES) {
    expect(g.ofxSteps.length).toBeGreaterThan(0);
    expect(g.csvSteps.length).toBeGreaterThan(0);
    expect(g.label.length).toBeGreaterThan(0);
  }
});

it("getBankGuide falls back to generic for an unknown id", () => {
  expect(getBankGuide("banco-inexistente").id).toBe("generic");
  expect(getBankGuide("nubank").id).toBe("nubank");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/constants/bank-import-guides.test.ts` → FAIL (module missing).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/constants/bank-import-guides.ts
export type BankGuide = {
  id: string;
  label: string;
  emoji: string;
  ofxSteps: string[];
  csvSteps: string[];
};

export const BANK_GUIDES: BankGuide[] = [
  {
    id: "nubank",
    label: "Nubank",
    emoji: "🟣",
    ofxSteps: ["Abra o app do Nubank", "Toque em Conta → Histórico", 'Toque em "Exportar extrato"', "Escolha o formato OFX e o período", "Salve o arquivo e volte aqui"],
    csvSteps: ["Abra o app do Nubank", "Conta → Histórico", 'Toque em "Exportar extrato"', "Escolha CSV e o período", "Salve e volte aqui"],
  },
  {
    id: "itau",
    label: "Itaú",
    emoji: "🟠",
    ofxSteps: ["Acesse o Itaú no navegador ou app", "Vá em Conta corrente → Extrato", "Selecione o período", 'Exporte em OFX (Money/OFX)', "Salve e volte aqui"],
    csvSteps: ["Acesse o Itaú", "Conta corrente → Extrato", "Selecione o período", "Exporte em CSV/Excel", "Salve e volte aqui"],
  },
  {
    id: "bradesco",
    label: "Bradesco",
    emoji: "🔴",
    ofxSteps: ["Acesse o Bradesco", "Conta → Extrato", "Escolha o período", "Exporte em OFX", "Salve e volte aqui"],
    csvSteps: ["Acesse o Bradesco", "Conta → Extrato", "Escolha o período", "Exporte em CSV", "Salve e volte aqui"],
  },
  {
    id: "inter",
    label: "Inter",
    emoji: "🟧",
    ofxSteps: ["Abra o app do Inter", "Extrato → filtro de período", "Toque no ícone de exportar", "Escolha OFX", "Salve e volte aqui"],
    csvSteps: ["Abra o app do Inter", "Extrato → período", "Exportar → CSV", "Salve e volte aqui"],
  },
  {
    id: "c6",
    label: "C6 Bank",
    emoji: "⚫",
    ofxSteps: ["Abra o app do C6", "Extrato → período", "Exportar extrato → OFX", "Salve e volte aqui"],
    csvSteps: ["Abra o app do C6", "Extrato → período", "Exportar → CSV", "Salve e volte aqui"],
  },
  {
    id: "bb",
    label: "Banco do Brasil",
    emoji: "🟡",
    ofxSteps: ["Acesse o BB (app ou site)", "Conta → Extrato", "Selecione o período", "Exporte em OFX", "Salve e volte aqui"],
    csvSteps: ["Acesse o BB", "Conta → Extrato", "Período", "Exporte em CSV", "Salve e volte aqui"],
  },
  {
    id: "caixa",
    label: "Caixa",
    emoji: "🔵",
    ofxSteps: ["Acesse o Caixa (app ou internet banking)", "Conta → Extrato", "Selecione o período", "Exporte em OFX", "Salve e volte aqui"],
    csvSteps: ["Acesse o Caixa", "Conta → Extrato", "Período", "Exporte em CSV", "Salve e volte aqui"],
  },
  {
    id: "generic",
    label: "Outro banco",
    emoji: "🏦",
    ofxSteps: ["Acesse seu banco (app ou site)", "Encontre a tela de Extrato", "Selecione o período desejado", "Procure a opção Exportar/Baixar em OFX", "Salve o arquivo e volte aqui"],
    csvSteps: ["Acesse seu banco", "Tela de Extrato", "Selecione o período", "Exporte/baixe em CSV", "Salve o arquivo e volte aqui"],
  },
];

export function getBankGuide(id: string): BankGuide {
  return BANK_GUIDES.find((g) => g.id === id) ?? BANK_GUIDES.find((g) => g.id === "generic")!;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/constants/bank-import-guides.test.ts` → PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/constants/bank-import-guides.ts src/constants/bank-import-guides.test.ts
git commit -m "feat(imports): per-bank statement export guides"
```

---

### Task 3: pickStatement helper

**Files:**
- Create: `src/lib/pick-statement.ts`
- Test: `src/lib/pick-statement.test.ts`

**Interfaces:**
- Consumes: `expo-document-picker`, `expo-file-system` (`File`).
- Produces: `pickStatement(): Promise<{ name: string; content: string } | null>` — opens the document picker (`copyToCacheDirectory: true`), reads the picked file's text via `new File(uri).text()`; returns `null` when the user cancels.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/pick-statement.test.ts
const getDocumentAsync = jest.fn();
const text = jest.fn();
jest.mock("expo-document-picker", () => ({ getDocumentAsync: (...a: unknown[]) => getDocumentAsync(...a) }));
jest.mock("expo-file-system", () => ({ File: jest.fn().mockImplementation(() => ({ text })) }));

import { pickStatement } from "./pick-statement";

beforeEach(() => { getDocumentAsync.mockReset(); text.mockReset(); });

it("returns null when the user cancels", async () => {
  getDocumentAsync.mockResolvedValue({ canceled: true });
  expect(await pickStatement()).toBeNull();
});

it("returns the file name + text when a file is picked", async () => {
  getDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///x.ofx", name: "x.ofx" }] });
  text.mockResolvedValue("<OFX>...</OFX>");
  const res = await pickStatement();
  expect(res).toEqual({ name: "x.ofx", content: "<OFX>...</OFX>" });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/lib/pick-statement.test.ts` → FAIL (module missing).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/pick-statement.ts
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";

// Opens the system document picker for a statement file (.ofx/.csv) and reads its
// text. Returns null if the user cancels. `copyToCacheDirectory` gives a local URI
// the File API can read immediately.
export async function pickStatement(): Promise<{ name: string; content: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    type: ["application/x-ofx", "text/csv", "text/comma-separated-values", "text/plain", "*/*"],
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const content = await new File(asset.uri).text();
  return { name: asset.name, content };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/lib/pick-statement.test.ts` → PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pick-statement.ts src/lib/pick-statement.test.ts
git commit -m "feat(imports): pickStatement (document picker + file read)"
```

---

### Task 4: WizardFooter

**Files:**
- Create: `src/components/imports/wizard-footer.tsx`
- Test: `src/components/imports/wizard-footer.test.tsx`

**Interfaces:**
- Consumes: `Button` (design system).
- Produces: `<WizardFooter primaryLabel onPrimary onBack? primaryLoading? primaryDisabled? />` — a footer row: an optional "‹ Voltar" ghost button (rendered only when `onBack` given) + a primary `Button` (flex-1) with `loading`/`disabled`. Uses `border-t border-border bg-bg`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/imports/wizard-footer.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import { WizardFooter } from "./wizard-footer";

it("fires primary + back", async () => {
  const onPrimary = jest.fn();
  const onBack = jest.fn();
  const { getByText } = await render(
    <WizardFooter primaryLabel="Continuar" onPrimary={onPrimary} onBack={onBack} />,
  );
  fireEvent.press(getByText("Continuar"));
  fireEvent.press(getByText("‹ Voltar"));
  expect(onPrimary).toHaveBeenCalled();
  expect(onBack).toHaveBeenCalled();
});

it("omits back when no onBack", async () => {
  const { queryByText } = await render(<WizardFooter primaryLabel="Ir" onPrimary={() => {}} />);
  expect(queryByText("‹ Voltar")).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/components/imports/wizard-footer.test.tsx` → FAIL.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/imports/wizard-footer.tsx
import { View } from "react-native";
import { Button } from "@/components/ui/button";

export function WizardFooter({
  primaryLabel,
  onPrimary,
  onBack,
  primaryLoading,
  primaryDisabled,
}: {
  primaryLabel: string;
  onPrimary: () => void;
  onBack?: () => void;
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-3 border-t border-border bg-bg p-4">
      {onBack ? <Button label="‹ Voltar" variant="ghost" onPress={onBack} /> : null}
      <View className="flex-1">
        <Button label={primaryLabel} onPress={onPrimary} loading={primaryLoading} disabled={primaryDisabled} />
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/components/imports/wizard-footer.test.tsx` → PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/imports/wizard-footer.tsx src/components/imports/wizard-footer.test.tsx
git commit -m "feat(imports): WizardFooter (fixed-footer CTA + back)"
```

---

### Task 5: ReviewRow + CategoryPickerSheet

**Files:**
- Create: `src/components/imports/review-row.tsx`
- Create: `src/components/imports/category-picker-sheet.tsx`
- Test: `src/components/imports/review-row.test.tsx`

**Interfaces:**
- Consumes: `AmountText`, `Text`, `Badge`, `Sheet`, `ListRow` (design system).
- Produces:
  - `ReviewRow`: `<ReviewRow row included onToggle onEditCategory />` where `row = { description, amountCents, direction, suggestedCategory: string|null, duplicate }`. Shows an include checkbox (a `Pressable`, `accessibilityRole="checkbox"`, `accessibilityState={{checked: included}}`), the description, a category `Badge` (pressable → `onEditCategory`), and `AmountText` with signed cents. Duplicate rows show a "duplicada" badge.
  - `CategoryPickerSheet`: `<CategoryPickerSheet visible categories onPick onClose />` — a `Sheet` listing category names (`ListRow`), tapping → `onPick(name)`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/imports/review-row.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import { ReviewRow } from "./review-row";

const row = { description: "iFood", amountCents: 4590, direction: "out" as const, suggestedCategory: "Alimentação", duplicate: false };

it("renders description, category, signed amount; toggles + edits", async () => {
  const onToggle = jest.fn();
  const onEditCategory = jest.fn();
  const { getByText, getByRole } = await render(
    <ReviewRow row={row} included onToggle={onToggle} onEditCategory={onEditCategory} />,
  );
  expect(getByText("iFood")).toBeTruthy();
  expect(getByText(/45,90/)).toBeTruthy();
  fireEvent.press(getByRole("checkbox"));
  fireEvent.press(getByText("Alimentação"));
  expect(onToggle).toHaveBeenCalled();
  expect(onEditCategory).toHaveBeenCalled();
});

it("marks duplicates", async () => {
  const { getByText } = await render(
    <ReviewRow row={{ ...row, duplicate: true }} included={false} onToggle={() => {}} onEditCategory={() => {}} />,
  );
  expect(getByText(/duplicada/i)).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/components/imports/review-row.test.tsx` → FAIL.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/imports/review-row.tsx
import { Pressable, View } from "react-native";
import { cn } from "@/lib/utils";
import { AmountText } from "@/components/ui/amount-text";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";

type Row = {
  description: string;
  amountCents: number;
  direction: "in" | "out";
  suggestedCategory: string | null;
  duplicate: boolean;
};

export function ReviewRow({
  row,
  included,
  onToggle,
  onEditCategory,
}: {
  row: Row;
  included: boolean;
  onToggle: () => void;
  onEditCategory: () => void;
}) {
  const signed = row.direction === "out" ? -row.amountCents : row.amountCents;
  return (
    <View className="flex-row items-center gap-3 border-b border-border py-3">
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: included }}
        onPress={onToggle}
        className={cn(
          "h-6 w-6 items-center justify-center rounded-md border-2 border-accent",
          included ? "bg-accent" : "bg-transparent",
        )}
      >
        {included ? <Text className="text-xs text-accent-fg">✓</Text> : null}
      </Pressable>
      <View className="flex-1 gap-1">
        <Text className="text-fg">
          {row.description}
          {row.duplicate ? <Text className="text-xs text-warning"> · duplicada</Text> : null}
        </Text>
        <Pressable accessibilityRole="button" onPress={onEditCategory} className="self-start">
          <Badge label={row.suggestedCategory ?? "Sem categoria"} tone="neutral" />
        </Pressable>
      </View>
      <AmountText cents={signed} />
    </View>
  );
}
```

```tsx
// src/components/imports/category-picker-sheet.tsx
import { Sheet } from "@/components/ui/sheet";
import { ListRow } from "@/components/ui/list-row";

export function CategoryPickerSheet({
  visible,
  categories,
  onPick,
  onClose,
}: {
  visible: boolean;
  categories: { id: string; name: string }[];
  onPick: (name: string) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Escolher categoria">
      {categories.map((c) => (
        <ListRow key={c.id} title={c.name} onPress={() => onPick(c.name)} />
      ))}
    </Sheet>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/components/imports/review-row.test.tsx` → PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/imports/review-row.tsx src/components/imports/category-picker-sheet.tsx src/components/imports/review-row.test.tsx
git commit -m "feat(imports): ReviewRow + CategoryPickerSheet"
```

---

### Task 6: ImportWizard

**Files:**
- Create: `src/components/imports/import-wizard.tsx`
- Test: `src/components/imports/import-wizard.test.tsx`

**Interfaces:**
- Consumes: `useListAccounts`, `useListCategories`, `usePreviewImport`, `useCommitImport` (`@/api/generated`); `pickStatement` (Task 3); `getBankGuide`/`BANK_GUIDES` (Task 2); `WizardFooter` (Task 4); `ReviewRow`/`CategoryPickerSheet` (Task 5); `Card`, `Text`, `Segmented`, `ListRow`, `Badge`, `EmptyState` (design system).
- Produces: `<ImportWizard onDone />` — a 5-step state machine (`account | source | file | review | result`) rendering a scrollable body + a fixed `WizardFooter`. Holds `accountId`, `bankId`, `source` (`ofx`/`csv`), picked `{name,content}`, `previewRows`, and per-row `{ included, categoryName }` edits. Step transitions:
  - **account**: `useListAccounts` list (select one) → footer "Continuar" (disabled until selected).
  - **source**: `Segmented` OFX/CSV + a bank `Segmented`/list showing `getBankGuide(bankId)` steps → footer "‹ Voltar" / "Escolher arquivo" → calls `pickStatement()`; on a file, advance to file step (or straight to preview).
  - **file**: shows picked file name (or a pick prompt) → footer "Analisar extrato" → `usePreviewImport().mutate({ data: { source, accountId, content } })`; on success store rows (each `included = !duplicate`, `categoryName = suggestedCategory`) and go to review.
  - **review**: `ReviewRow` per preview row + `CategoryPickerSheet` (categories from `useListCategories`); footer "Importar N" (N = included count) → `useCommitImport().mutate({ data: { accountId, source, rows: includedRows.map(...) } })` → go to result.
  - **result**: summary (`imported`/`skipped`) → footer "Ver transações" (calls `onDone`) + a "Importar outro" reset.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/imports/import-wizard.test.tsx
const previewMutate = jest.fn();
const commitMutate = jest.fn();
const pickStatement = jest.fn();
jest.mock("@/api/generated", () => ({
  useListAccounts: () => ({ data: { accounts: [{ id: "a1", name: "Nubank", kind: "checking" }] } }),
  useListCategories: () => ({ data: { categories: [{ id: "c1", name: "Alimentação", kind: "expense" }] } }),
  usePreviewImport: () => ({ mutate: previewMutate, isPending: false }),
  useCommitImport: () => ({ mutate: commitMutate, isPending: false }),
}));
jest.mock("@/lib/pick-statement", () => ({ pickStatement: () => pickStatement() }));

import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { ImportWizard } from "./import-wizard";

beforeEach(() => { previewMutate.mockReset(); commitMutate.mockReset(); pickStatement.mockReset(); });

it("walks account → source → file → preview → review → commit", async () => {
  pickStatement.mockResolvedValue({ name: "x.ofx", content: "<OFX/>" });
  previewMutate.mockImplementation((_v, opts) =>
    opts.onSuccess({ rows: [
      { amountCents: 4590, direction: "out", occurredAt: "2026-07-15T00:00:00.000Z", description: "iFood", rawRef: "TX1", suggestedCategory: "Alimentação", confidence: 90, duplicate: false },
      { amountCents: 1850, direction: "out", occurredAt: "2026-07-16T00:00:00.000Z", description: "Uber", rawRef: "TX2", suggestedCategory: null, confidence: 0, duplicate: true },
    ] }),
  );
  commitMutate.mockImplementation((_v, opts) => opts.onSuccess({ importId: "imp1", imported: 1, skipped: 1 }));
  const onDone = jest.fn();

  const { getByText } = await render(<ImportWizard onDone={onDone} />);
  fireEvent.press(getByText("Nubank"));          // pick account
  fireEvent.press(getByText("Continuar"));
  fireEvent.press(getByText("Escolher arquivo")); // source step → pick file
  await waitFor(() => expect(getByText("Analisar extrato")).toBeTruthy());
  fireEvent.press(getByText("Analisar extrato")); // → preview
  await waitFor(() => expect(getByText("iFood")).toBeTruthy());
  // Uber is a duplicate → pre-excluded, so only 1 included → "Importar 1"
  fireEvent.press(getByText("Importar 1"));
  expect(commitMutate).toHaveBeenCalledWith(
    { data: expect.objectContaining({ accountId: "a1", source: "ofx", rows: expect.any(Array) }) },
    expect.any(Object),
  );
  const committedRows = (commitMutate.mock.calls[0][0] as { data: { rows: unknown[] } }).data.rows;
  expect(committedRows).toHaveLength(1); // duplicate excluded
  await waitFor(() => expect(getByText(/1 importada/i)).toBeTruthy());
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/components/imports/import-wizard.test.tsx` → FAIL (module missing).

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/imports/import-wizard.tsx
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useCommitImport, useListAccounts, useListCategories, usePreviewImport } from "@/api/generated";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { Segmented } from "@/components/ui/segmented";
import { Text } from "@/components/ui/text";
import { BANK_GUIDES, getBankGuide } from "@/constants/bank-import-guides";
import { pickStatement } from "@/lib/pick-statement";
import { CategoryPickerSheet } from "./category-picker-sheet";
import { ReviewRow } from "./review-row";
import { WizardFooter } from "./wizard-footer";

type Step = "account" | "source" | "file" | "review" | "result";
type Source = "ofx" | "csv";
type PreviewRow = {
  amountCents: number; direction: "in" | "out"; occurredAt: string; description: string;
  rawRef: string | null; suggestedCategory: string | null; confidence: number; duplicate: boolean;
};
type Edit = { included: boolean; categoryName: string | null };

const SOURCES: { value: Source; label: string }[] = [
  { value: "ofx", label: "OFX" },
  { value: "csv", label: "CSV" },
];

export function ImportWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>("account");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [bankId, setBankId] = useState("nubank");
  const [source, setSource] = useState<Source>("ofx");
  const [file, setFile] = useState<{ name: string; content: string } | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [edits, setEdits] = useState<Edit[]>([]);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [pickingCategory, setPickingCategory] = useState<number | null>(null);

  const accounts = useListAccounts().data?.accounts ?? [];
  const categories = useListCategories().data?.categories ?? [];
  const preview = usePreviewImport();
  const commit = useCommitImport();
  const guide = getBankGuide(bankId);
  const includedCount = edits.filter((e) => e.included).length;

  const pick = async () => {
    const picked = await pickStatement();
    if (picked) { setFile(picked); setStep("file"); }
  };

  const analyze = () => {
    if (!accountId || !file) return;
    preview.mutate(
      { data: { source, accountId, content: file.content } },
      {
        onSuccess: (res: { rows: PreviewRow[] }) => {
          setRows(res.rows);
          setEdits(res.rows.map((r) => ({ included: !r.duplicate, categoryName: r.suggestedCategory })));
          setStep("review");
        },
      },
    );
  };

  const doCommit = () => {
    if (!accountId) return;
    const payloadRows = rows
      .map((r, i) => ({ r, e: edits[i] }))
      .filter(({ e }) => e.included)
      .map(({ r, e }) => ({
        amountCents: r.amountCents, direction: r.direction, occurredAt: r.occurredAt,
        description: r.description, rawRef: r.rawRef, categoryName: e.categoryName,
      }));
    commit.mutate(
      { data: { accountId, source, rows: payloadRows } },
      { onSuccess: (res: { imported: number; skipped: number }) => { setResult(res); setStep("result"); } },
    );
  };

  return (
    <View className="flex-1 bg-bg">
      <ScrollView className="flex-1 p-5" contentContainerStyle={{ gap: 12 }}>
        {step === "account" && (
          <View className="gap-2">
            <Text variant="title">Qual conta?</Text>
            {accounts.map((a) => (
              <ListRow key={a.id} title={a.name} subtitle={a.kind}
                leading={<Badge label={a.id === accountId ? "✓" : "·"} tone={a.id === accountId ? "income" : "neutral"} />}
                onPress={() => setAccountId(a.id)} />
            ))}
          </View>
        )}
        {step === "source" && (
          <View className="gap-3">
            <Text variant="title">Como baixar seu extrato</Text>
            <Segmented options={SOURCES} value={source} onChange={setSource} />
            <Segmented options={BANK_GUIDES.map((g) => ({ value: g.id, label: g.label }))} value={bankId} onChange={setBankId} />
            <Card className="gap-2">
              <Text variant="label">{guide.emoji} {guide.label} → {source.toUpperCase()}</Text>
              {(source === "ofx" ? guide.ofxSteps : guide.csvSteps).map((s, i) => (
                <Text key={i} className="text-fg-secondary">{i + 1}. {s}</Text>
              ))}
            </Card>
          </View>
        )}
        {step === "file" && (
          <View className="gap-3">
            <Text variant="title">Arquivo</Text>
            {file ? <ListRow title={file.name} subtitle="selecionado" /> : <Text className="text-fg-secondary">Nenhum arquivo</Text>}
            <Text className="text-accent" onPress={pick}>Escolher outro arquivo</Text>
          </View>
        )}
        {step === "review" && (
          <View>
            <Text variant="title" className="mb-2">Revisar · {rows.length} encontradas</Text>
            {rows.map((r, i) => (
              <ReviewRow key={`${r.rawRef ?? "n"}-${i}`} row={r} included={edits[i]?.included ?? false}
                onToggle={() => setEdits((prev) => prev.map((e, j) => (j === i ? { ...e, included: !e.included } : e)))}
                onEditCategory={() => setPickingCategory(i)} />
            ))}
          </View>
        )}
        {step === "result" && result && (
          <View className="items-center gap-2 py-8">
            <Text variant="display" className="text-income">{result.imported}</Text>
            <Text className="text-fg-secondary">{result.imported} importada(s)</Text>
            {result.skipped > 0 ? <Text className="text-fg-secondary">{result.skipped} pulada(s)</Text> : null}
          </View>
        )}
      </ScrollView>

      {step === "account" && <WizardFooter primaryLabel="Continuar" primaryDisabled={!accountId} onPrimary={() => setStep("source")} />}
      {step === "source" && <WizardFooter primaryLabel="Escolher arquivo" onBack={() => setStep("account")} onPrimary={pick} />}
      {step === "file" && <WizardFooter primaryLabel="Analisar extrato" primaryLoading={preview.isPending} primaryDisabled={!file} onBack={() => setStep("source")} onPrimary={analyze} />}
      {step === "review" && <WizardFooter primaryLabel={`Importar ${includedCount}`} primaryLoading={commit.isPending} primaryDisabled={includedCount === 0} onBack={() => setStep("file")} onPrimary={doCommit} />}
      {step === "result" && <WizardFooter primaryLabel="Ver transações" onPrimary={onDone} />}

      <CategoryPickerSheet
        visible={pickingCategory !== null}
        categories={categories}
        onPick={(name) => {
          setEdits((prev) => prev.map((e, j) => (j === pickingCategory ? { ...e, categoryName: name } : e)));
          setPickingCategory(null);
        }}
        onClose={() => setPickingCategory(null)}
      />
    </View>
  );
}
```

UX note: the bank `Segmented` with 8 options will be cramped on a phone. Acceptable for this task's gate (tests + build), but wrap it in a horizontal `ScrollView` (or swap to a scrollable chip row) so the pills don't squash — do this within this task if quick, else leave a `// TODO: scrollable bank picker` and it's a fine follow-up. Functionality/tests are unaffected either way.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/components/imports/import-wizard.test.tsx` → PASS. If a step transition needs a `waitFor` the test lacks, the test (not the component) is adjusted — but keep the commit-payload + result assertions intact.

- [ ] **Step 5: Commit**

```bash
git add src/components/imports/import-wizard.tsx src/components/imports/import-wizard.test.tsx
git commit -m "feat(imports): ImportWizard step machine (preview → review → commit)"
```

---

### Task 7: Screen route + transactions entry point

**Files:**
- Create: `src/app/import.tsx`
- Modify: `src/app/(tabs)/transactions.tsx` (remove the paste box + textarea; add an "Importar extrato" button that navigates to `/import`)
- Test: none new (the wizard is tested in Task 6; the transactions edit is verified by the headless export in Task 8).

**Interfaces:**
- Consumes: `ImportWizard` (Task 6), `expo-router` (`router`).
- Produces: `src/app/import.tsx` default-exporting a screen that renders `<ImportWizard onDone={() => router.replace("/(tabs)/transactions")} />`.

- [ ] **Step 1: Write the import route**

```tsx
// src/app/import.tsx
import { router } from "expo-router";
import { ImportWizard } from "@/components/imports/import-wizard";

export default function ImportScreen() {
  return <ImportWizard onDone={() => router.replace("/(tabs)/transactions")} />;
}
```

- [ ] **Step 2: Update the transactions screen**

Read `src/app/(tabs)/transactions.tsx`. Remove: the `content` state, the multiline `TextInput` import box, the `onImport` handler, `createImport`/`useCreateImport` usage, and the now-unused imports (`TextInput`, `useCreateImport`, `useCreateAccount` if only used by the removed box — verify before deleting). Replace the import box block with a single navigation button:

```tsx
import { router } from "expo-router";
// ...
<Button className="mt-4" label="Importar extrato" onPress={() => router.push("/import")} />
```

Keep the transactions list and everything else. Do not restyle unrelated parts in this task.

- [ ] **Step 3: Verify jest still green**

Run: `pnpm jest` → all pass (removing the paste box shouldn't break any test; there is no test asserting the old textarea).

- [ ] **Step 4: Commit**

```bash
git add src/app/import.tsx "src/app/(tabs)/transactions.tsx"
git commit -m "feat(imports): import wizard route + transactions entry point (remove paste box)"
```

---

### Task 8: Full-suite + headless build gate

**Files:** none.

- [ ] **Step 1: Full suite** — `pnpm jest` → all pass; report totals.
- [ ] **Step 2: No test under src/app** — `find src/app -name '*.test.*'` → empty.
- [ ] **Step 3: Headless build** — `npx expo export --platform ios` → EXIT 0 (compiles the wizard + expo-file-system/document-picker imports + the new route). Report module count. If it fails on `expo-file-system` native resolution, confirm the dep installed (Task 1) and that `File` is imported from `expo-file-system` (not a subpath).
- [ ] **Step 4: Commit** (only if a lint-fix touched files).

---

## Self-Review

**Spec coverage (frontend):**
- 5-step wizard with fixed footer → Tasks 4 (footer) + 6 (wizard). ✓
- Guided file import: document picker + per-bank instructions → Tasks 2 (guides) + 3 (pickStatement) + 6 (source step). ✓
- Preview before commit + review (exclude, change category, duplicates flagged) → Tasks 5 (ReviewRow/picker) + 6 (review step, preview→commit). ✓
- Result summary → Task 6 (result step). ✓
- Reachable via transactions button, paste box removed → Task 7. ✓
- Built on the design system; hooks generated; expo-file-system added → Tasks 1–7. ✓

**Placeholder scan:** None.

**Type consistency:** `PreviewRow`/`CommitRow` shapes match Plan A's contract (verified against the spec + generated types). `usePreviewImport`/`useCommitImport` are `.mutate({ data })` (confirmed from generated hooks). Account/category ids are uuids. Commit body includes `source` (Plan A requires it). `File.text()` (not deprecated `readAsStringAsync`) per Expo SDK 57 docs.

## Known Issue (pre-existing, out of scope)

`pnpm tsc --noEmit` reports ~110 errors, ALL in `*.test.*` files (jest globals under pnpm) — inherited; tests run via babel-jest. Gate on `pnpm jest` + `npx expo export`, not `tsc`.
