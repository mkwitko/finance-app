# AI Copilot Insights — Frontend (Plan B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the insights feed UX in finance-app — a screen listing AI-generated insight cards (with optional advice) for the active household, with loading/empty states and refresh — on the design system, consuming Plan A's endpoints via Kubb hooks.

**Architecture:** An `InsightCard` (severity-toned, recommendation behind a `DisclosureSection`) and an `InsightsFeed` (data + states + refresh) composed into a `(tabs)/insights.tsx` screen. Data via `useGetInsights` (query) / `useRefreshInsights` (mutation); active household uuid from `household-store` is the `:id` path param.

**Tech Stack:** Expo SDK 57, React 19, NativeWind v4.2, TanStack Query, Kubb hooks, Jest + RNTL 14.

## Global Constraints

- **RNTL 14.0.1 `render()` is async** — `const {...} = await render(<...>)` in `async` tests; state-changing interactions under `await waitFor(...)`. Follow `src/components/theme/theme-picker.test.tsx`.
- **Component/route tests must NOT live under `src/app/`** — Expo Router's `require.context` bundles everything there as a route (would pull `@testing-library/react-native` into the app bundle and break `expo export`). Component tests co-locate under `src/components/`; any route test goes at `src/<name>.test.tsx` importing via `@/app/...` (see `src/join-route.test.tsx`).
- Components use **design-system components + semantic tokens only** (`bg-bg`, `text-fg`, `text-expense`, etc.) — no raw hex / `bg-neutral-*`. Import UI from `@/components/ui/*`.
- Generated hooks from `@/api/generated`; tests **mock `@/api/generated`** and `@/stores/household-store` — never hit the network.
- Active household uuid = `useHouseholdStore((s) => s.activeHouseholdId)`; it is the `:id` for `useGetInsights(id, { query: { enabled } })` and `useRefreshInsights().mutate({ id })`. Gate the query with `enabled: Boolean(activeHouseholdId)`.
- Insight shape (from `GetInsights200`): `{ id, kind, severity, title, body, recommendation: string | null, periodStart, periodEnd, generatedAt }`. `severity ∈ info | warning | positive`; `kind ∈ spending_alert | summary | trend | advice`.
- Severity → design-system Badge/tone: `positive → income`, `warning → warning`, `info → neutral`.
- **Gate is `pnpm jest`** (per task) + `npx expo export --platform ios` exit 0 (final). NOT `tsc` (pre-existing ~110 test-file jest-global errors; non-test source is clean).
- Commit directly on `master`; stage only the files each task names (never `git add -A`).

---

### Task 1: Regenerate API hooks

**Files:** Modify `src/api/generated/**`.

**Interfaces:** Produces `useGetInsights`, `useGetInsightsSuspense`, `useRefreshInsights` from `@/api/generated`.

- [ ] **Step 1: Regenerate**

Run: `pnpm api:generate` (a `✗ Prettier not found` warning is harmless).

- [ ] **Step 2: Verify**

Run: `ls src/api/generated/hooks | grep -i Insight` → `useGetInsights.ts`, `useGetInsightsSuspense.ts`, `useRefreshInsights.ts`.
Run: `grep -q "useRefreshInsights" src/api/generated/index.ts && echo OK` → `OK`.

- [ ] **Step 3: Commit**

```bash
git add src/api/generated
git commit -m "chore(api): regenerate hooks with insights endpoints"
```

---

### Task 2: InsightCard

**Files:**
- Create: `src/components/insights/insight-card.tsx`
- Test: `src/components/insights/insight-card.test.tsx`

**Interfaces:**
- Consumes: `Card`, `Text`, `Badge`, `DisclosureSection` (design system).
- Produces: `<InsightCard insight />` where `insight = { kind: string; severity: "info"|"warning"|"positive"; title: string; body: string; recommendation: string | null }`. Renders a `Card` with a severity `Badge` (tone mapped), `title` (Text `title`), `body` (Text), and — only when `recommendation` is non-null — a `DisclosureSection` titled "Ver recomendação" containing the recommendation text.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/insights/insight-card.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import { InsightCard } from "./insight-card";

const base = { kind: "summary", severity: "positive" as const, title: "Bom mês", body: "Você economizou.", recommendation: null };

it("renders title, body, and a severity badge", async () => {
  const { getByText } = await render(<InsightCard insight={base} />);
  expect(getByText("Bom mês")).toBeTruthy();
  expect(getByText("Você economizou.")).toBeTruthy();
});

it("hides the recommendation until disclosed, then shows it", async () => {
  const { queryByText, getByText } = await render(
    <InsightCard insight={{ ...base, kind: "advice", severity: "info", recommendation: "Defina um limite." }} />,
  );
  expect(queryByText("Defina um limite.")).toBeNull();
  fireEvent.press(getByText("Ver recomendação"));
  expect(getByText("Defina um limite.")).toBeTruthy();
});

it("shows no disclosure when there is no recommendation", async () => {
  const { queryByText } = await render(<InsightCard insight={base} />);
  expect(queryByText("Ver recomendação")).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/components/insights/insight-card.test.tsx`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/insights/insight-card.tsx
import { View } from "react-native";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DisclosureSection } from "@/components/ui/disclosure-section";
import { Text } from "@/components/ui/text";

type Severity = "info" | "warning" | "positive";
type Insight = {
  kind: string;
  severity: Severity;
  title: string;
  body: string;
  recommendation: string | null;
};

const TONE: Record<Severity, "neutral" | "warning" | "income"> = {
  info: "neutral",
  warning: "warning",
  positive: "income",
};
const SEVERITY_LABEL: Record<Severity, string> = {
  info: "Info",
  warning: "Atenção",
  positive: "Positivo",
};

export function InsightCard({ insight }: { insight: Insight }) {
  return (
    <Card className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text variant="title">{insight.title}</Text>
        <Badge label={SEVERITY_LABEL[insight.severity]} tone={TONE[insight.severity]} />
      </View>
      <Text className="text-fg-secondary">{insight.body}</Text>
      {insight.recommendation ? (
        <DisclosureSection title="Ver recomendação">
          <Text className="text-fg">{insight.recommendation}</Text>
        </DisclosureSection>
      ) : null}
    </Card>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/components/insights/insight-card.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/insights/insight-card.tsx src/components/insights/insight-card.test.tsx
git commit -m "feat(insights): InsightCard with severity tone + recommendation disclosure"
```

---

### Task 3: InsightsFeed

**Files:**
- Create: `src/components/insights/insights-feed.tsx`
- Test: `src/components/insights/insights-feed.test.tsx`

**Interfaces:**
- Consumes: `InsightCard` (Task 2), `Skeleton`, `EmptyState`, `Button`, `Text` (design system); `useGetInsights`, `useRefreshInsights` (`@/api/generated`); `useHouseholdStore`.
- Produces: `<InsightsFeed />` — reads `activeHouseholdId`; `useGetInsights(activeHouseholdId ?? undefined, { query: { enabled: Boolean(activeHouseholdId) } })`. States: `isLoading` → a few `Skeleton` rows; empty (`insights.length === 0`) → `EmptyState` ("Ainda não há insights", message about importing/refreshing); else a scrollable list of `InsightCard`. A header "Atualizar" `Button` calls `useRefreshInsights().mutate({ id: activeHouseholdId }, { onSettled: () => refetch() })` (refresh is adult-only server-side; on a viewer's 403 the mutation errors but `onSettled` still refetches the cached feed — errors are swallowed for this non-critical action). Button disabled while `isPending` or when no active household. Also wire a `RefreshControl` on the scroll view calling the same handler.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/insights/insights-feed.test.tsx
const mutate = jest.fn();
let mockQuery: { data?: { insights: unknown[] }; isLoading: boolean; refetch: () => void };
jest.mock("@/api/generated", () => ({
  useGetInsights: () => mockQuery,
  useRefreshInsights: () => ({ mutate, isPending: false }),
}));
jest.mock("@/stores/household-store", () => ({
  useHouseholdStore: (sel: (s: unknown) => unknown) => sel({ activeHouseholdId: "h1" }),
}));

import { fireEvent, render } from "@testing-library/react-native";
import { InsightsFeed } from "./insights-feed";

beforeEach(() => { mutate.mockClear(); });

it("shows an empty state when there are no insights", async () => {
  mockQuery = { data: { insights: [] }, isLoading: false, refetch: jest.fn() };
  const { getByText } = await render(<InsightsFeed />);
  expect(getByText(/Ainda não há insights/i)).toBeTruthy();
});

it("renders insight cards", async () => {
  mockQuery = {
    data: { insights: [{ id: "i1", kind: "summary", severity: "positive", title: "Resumo", body: "corpo", recommendation: null }] },
    isLoading: false,
    refetch: jest.fn(),
  };
  const { getByText } = await render(<InsightsFeed />);
  expect(getByText("Resumo")).toBeTruthy();
});

it("refresh button triggers regeneration for the active household", async () => {
  const refetch = jest.fn();
  mockQuery = { data: { insights: [] }, isLoading: false, refetch };
  const { getByText } = await render(<InsightsFeed />);
  fireEvent.press(getByText("Atualizar"));
  expect(mutate).toHaveBeenCalledWith({ id: "h1" }, expect.any(Object));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/components/insights/insights-feed.test.tsx`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/insights/insights-feed.tsx
import { RefreshControl, ScrollView, View } from "react-native";
import { useGetInsights, useRefreshInsights } from "@/api/generated";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { InsightCard } from "@/components/insights/insight-card";
import { useHouseholdStore } from "@/stores/household-store";

export function InsightsFeed() {
  const householdId = useHouseholdStore((s) => s.activeHouseholdId);
  const { data, isLoading, refetch } = useGetInsights(householdId ?? undefined, {
    query: { enabled: Boolean(householdId) },
  });
  const refresh = useRefreshInsights();

  const onRefresh = () => {
    if (!householdId) return;
    refresh.mutate({ id: householdId }, { onSettled: () => refetch() });
  };

  const insights = data?.insights ?? [];

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between p-5">
        <Text variant="title">Insights</Text>
        <Button
          label="Atualizar"
          variant="secondary"
          size="sm"
          onPress={onRefresh}
          loading={refresh.isPending}
          disabled={!householdId || refresh.isPending}
        />
      </View>
      {isLoading ? (
        <View className="gap-3 px-5">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </View>
      ) : insights.length === 0 ? (
        <EmptyState
          title="Ainda não há insights"
          message="Importe transações ou toque em Atualizar para gerar insights."
        />
      ) : (
        <ScrollView
          className="px-5"
          contentContainerClassName="gap-3 pb-8"
          refreshControl={<RefreshControl refreshing={refresh.isPending} onRefresh={onRefresh} />}
        >
          {insights.map((it) => (
            <InsightCard key={it.id} insight={it} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
```

Note: `contentContainerClassName` is a NativeWind v4 prop; if it isn't resolved in this setup, replace it with `contentContainerStyle={{ gap: 12, paddingBottom: 32 }}` (equivalent) — a rendering detail that won't affect the tests.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/components/insights/insights-feed.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/insights/insights-feed.tsx src/components/insights/insights-feed.test.tsx
git commit -m "feat(insights): InsightsFeed (loading/empty/list + refresh)"
```

---

### Task 4: Insights screen route

**Files:**
- Create: `src/app/(tabs)/insights.tsx`

**Interfaces:**
- Consumes: `InsightsFeed` (Task 3).
- Produces: a default-exported screen rendering `<InsightsFeed />`.

- [ ] **Step 1: Write the screen**

```tsx
// src/app/(tabs)/insights.tsx
import { InsightsFeed } from "@/components/insights/insights-feed";

export default function InsightsScreen() {
  return <InsightsFeed />;
}
```

(No unit test — it is a one-line composition of the tested `InsightsFeed`. Verified by the headless export in Task 5. Do NOT put a test file under `src/app/`.)

- [ ] **Step 2: Commit**

```bash
git add "src/app/(tabs)/insights.tsx"
git commit -m "feat(insights): insights tab screen"
```

---

### Task 5: Full-suite + headless build gate

**Files:** none (verification only).

- [ ] **Step 1: Full suite**

Run: `pnpm jest`
Expected: all suites pass (design-system + contexts + the new insights suites). Report totals.

- [ ] **Step 2: Headless build**

Run: `npx expo export --platform ios`
Expected: EXIT 0 (bundles). This compiles the new screen/components/hooks on native. If it fails pulling a test file as a route, confirm no `*.test.*` exists under `src/app/` (`find src/app -name '*.test.*'` must be empty).

- [ ] **Step 3: Commit (only if a lint-fix touched files)**

If nothing changed, nothing to commit.

---

## Self-Review

**Spec coverage (frontend of the insights spec):**
- Insights feed screen with severity-toned cards → Tasks 2, 3, 4. ✓
- Recommendation behind a disclosure → Task 2 (`DisclosureSection`). ✓
- Loading `Skeleton` / `EmptyState` / list → Task 3. ✓
- Pull-to-refresh + refresh button → Task 3 (`RefreshControl` + "Atualizar", `useRefreshInsights`). ✓
- Built on the design system, hooks generated → Tasks 1–3. ✓
- Viewer-vs-adult refresh: refresh is adult-only server-side; a viewer's press 403s but `onSettled` refetches the cache — no client role-gating needed, errors swallowed for this non-critical action. ✓

**Placeholder scan:** None.

**Type consistency:** `useGetInsights(id, { query })` returns `{ insights: InsightView[] }`; `useRefreshInsights().mutate({ id })` — both verified against the generated signatures. `InsightCard`'s `insight` prop shape matches `GetInsights200`'s array element. Active id = `activeHouseholdId` throughout.

## Known Issue (pre-existing, out of scope)

`pnpm tsc --noEmit` reports ~110 errors, ALL in `*.test.*` files (jest globals under pnpm) — inherited; tests run via babel-jest. Gate on `pnpm jest` + `npx expo export`, not `tsc`.
