# Subscription v2 (Stripe) — Frontend Implementation Plan (Plan B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the in-app subscription experience: subscribe via the native Stripe PaymentSheet (monthly/annual) and a custom manage portal (switch interval, cancel), plus reusable entitlement gating — all against the Stripe-backed backend (Plan A, already merged).

**Architecture:** `@stripe/stripe-react-native` provides `<StripeProvider>` + `useStripe().initPaymentSheet/presentPaymentSheet`. A `usePaymentSheetCheckout` hook chains the backend `checkout` mutation → PaymentSheet → refetch. Kubb-generated TanStack Query hooks (regenerated from the updated `api.json`) call the four subscription endpoints; the shared client already injects the `x-household-id` header from the household store. A `plan.tsx` screen is the subscribe + manage portal. `useEntitlements`/`useEntitlement`/`<PaywallGate>` are new reusable primitives. A minimal settings hub + tab makes the screen (and the pre-existing orphaned settings screens) reachable.

**Tech Stack:** Expo SDK 57, React Native 0.86, React 19, expo-router 57 (typed routes), TanStack Query, Kubb, NativeWind (token classNames), Zustand, jest-expo + RNTL.

## Global Constraints

- Expo SDK is `~57.0.4`; install Stripe with `npx expo install @stripe/stripe-react-native` (never a raw `npm install` — Expo pins the SDK-compatible version).
- `@stripe/stripe-react-native` ships native code: it requires a **dev/custom build** and does **not** run in Expo Go. Tests must **mock** it (jest-expo cannot load the native module).
- User-facing strings are hardcoded **pt-BR**, matching every existing screen (e.g. `members.tsx` uses `"Membros"`). Do NOT introduce `t()` for new copy (project has no en/es bundles for these; i18n pass is a separate follow-up).
- Import alias is `@/…` → `src/…`. UI comes from `@/components/ui/*` (`Button`, `Segmented`, `Card`, `Text`, `Sheet`, `ListRow`, `Badge`, `EmptyState`). Style with NativeWind token classes (`bg-bg`, `text-fg`, `text-fg-secondary`, `bg-bg-elevated`, `text-accent`, `border-border`, `gap-*`, `p-*`), never raw hex.
- Active household uuid comes from `useHouseholdStore((s) => s.activeHouseholdId)` and is the path param `id` for every subscription call. The API client auto-adds the `x-household-id` header — do not add it manually.
- Backend errors arrive as `ApiError` (`@/api/client`) carrying `.code` (e.g. `SUB-T0003`). Surface them via `contextErrorMessage` (extended in Task 3).
- Kubb output is generated — never hand-edit `src/api/generated/**`; change it only by editing `api.json` upstream (already done in Plan A) and running `npm run api:generate`.
- Verify commands: `npm run typecheck` (tsc), `npm run test` (jest), and headless `npx expo export` (exit 0) as the build gate.
- Publishable key for `<StripeProvider>` comes from `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (added to `src/env.ts`); empty in dev/tests is fine (app still boots).

## The subscription contract (from Plan A `api.json`)

- `GET /households/:id/subscription` → `SubscriptionView { plan: "free"|"premium", status: "active"|"canceled"|"expired", currentPeriodEnd: string|null, cancelAtPeriodEnd: boolean, interval: "monthly"|"annual"|null, entitlements: { aiInsights, futureProjection, unlimitedContexts, maxContexts } }`. operationId `getSubscription` → hook `useGetSubscription(id, options)`.
- `POST /households/:id/subscription/checkout` body `{ interval }` → `CheckoutSessionView { paymentIntentClientSecret: string|null, ephemeralKeySecret: string, customerId: string, publishableKey: string }`. operationId `checkoutSubscription` → `useCheckoutSubscription()`.
- `POST /households/:id/subscription/switch` body `{ interval }` → `SubscriptionView`. operationId `switchSubscriptionInterval` → `useSwitchSubscriptionInterval()`.
- `POST /households/:id/subscription/cancel` → `SubscriptionView`. operationId `cancelSubscription` → `useCancelSubscription()`.

> Mutation hooks follow the repo convention (see `useUpdateMemberRole`): `.mutate({ id, data }, { onSuccess, onError })`; the cancel mutation takes `{ id }` only. Confirm the exact generated variable shape in Task 2 and use it verbatim thereafter.

---

### Task 1: Stripe SDK — install, config plugin, provider, env, jest mock

**Files:**
- Modify: `package.json` (dep added by expo install)
- Modify: `app.json` (plugins array)
- Modify: `src/env.ts`
- Modify: `src/app/_layout.tsx`
- Modify: `jest.setup.ts`
- Test: `src/app/_layout.test.tsx` is NOT required; verification is typecheck + a jest run that loads the mock.

**Interfaces:**
- Produces: `<StripeProvider>` mounted at root with `publishableKey={env.stripePublishableKey}`; `env.stripePublishableKey: string`; a global jest mock of `@stripe/stripe-react-native` exposing `StripeProvider` (passthrough) and `useStripe()` returning jest-fn `initPaymentSheet`/`presentPaymentSheet`.

- [ ] **Step 1: Install the SDK (Expo-pinned)**

Run: `npx expo install @stripe/stripe-react-native`
Expected: adds `@stripe/stripe-react-native` at the SDK-57-compatible version to `package.json`.

- [ ] **Step 2: Add the config plugin to app.json**

In `app.json`, append to the `plugins` array (after `"@react-native-google-signin/google-signin"`):

```json
      [
        "@stripe/stripe-react-native",
        {
          "merchantIdentifier": "merchant.com.financeapp",
          "enableGooglePay": false
        }
      ]
```

> `merchantIdentifier` is an Apple Pay placeholder (Apple Pay is out of scope for v1; card PaymentSheet works without it). Google Pay disabled for v1.

- [ ] **Step 3: Add the publishable-key env var**

In `src/env.ts`, add to `EnvSchema` and the parsed object:

```ts
  stripePublishableKey: z.string().optional(),
```
```ts
  stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
```

- [ ] **Step 4: Mount StripeProvider at the root**

In `src/app/_layout.tsx`, import and wrap the tree (inside `GestureHandlerRootView`, outside/around `ThemeProvider` is fine — put it as the outermost provider under GestureHandler):

```tsx
import { StripeProvider } from "@stripe/stripe-react-native";
import { env } from "@/env";
```

Wrap:

```tsx
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StripeProvider publishableKey={env.stripePublishableKey ?? ""} merchantIdentifier="merchant.com.financeapp" urlScheme="financeapp">
        <ThemeProvider>
          {/* ...existing tree unchanged... */}
        </ThemeProvider>
      </StripeProvider>
    </GestureHandlerRootView>
```

(`urlScheme` matches `app.json`'s `"scheme": "financeapp"`, needed for 3DS redirect return.)

- [ ] **Step 5: Mock the native module for jest**

In `jest.setup.ts`, add:

```ts
jest.mock("@stripe/stripe-react-native", () => {
  const React = require("react");
  return {
    StripeProvider: ({ children }: { children: React.ReactNode }) => children,
    useStripe: () => ({
      initPaymentSheet: jest.fn().mockResolvedValue({ error: undefined }),
      presentPaymentSheet: jest.fn().mockResolvedValue({ error: undefined }),
    }),
  };
});
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck`
Expected: 0 errors.
Run: `npm run test -- --listTests >/dev/null && npm run test 2>&1 | tail -5`
Expected: existing suite still passes (the mock loads; no test imports the real native module).

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml app.json src/env.ts src/app/_layout.tsx jest.setup.ts
git commit -m "feat(sub): add @stripe/stripe-react-native (plugin, provider, env, jest mock)"
```

---

### Task 2: Regenerate API hooks from the updated OpenAPI

**Files:**
- Modify: `api.json` (already updated by Plan A; confirm present)
- Generated: `src/api/generated/**` (regenerated)

**Interfaces:**
- Produces generated hooks + types: `useGetSubscription`, `useCheckoutSubscription`, `useSwitchSubscriptionInterval`, `useCancelSubscription`, and types `SubscriptionView`, `CheckoutSessionView`, request/path-param types. Later tasks import these from `@/api/generated`.

- [ ] **Step 1: Confirm the fixture carries the new operations**

Run:
```bash
grep -o "getSubscription\|checkoutSubscription\|switchSubscriptionInterval\|cancelSubscription\|activateSubscription" api.json | sort -u
```
Expected: the first four present, `activateSubscription` absent. If missing, STOP — the Plan A export did not land; re-run `npx tsx ../finance-back/scripts/export-openapi.ts ./api.json` from finance-back is out of scope here, so escalate.

- [ ] **Step 2: Regenerate**

Run: `npm run api:generate`
Expected: Kubb writes into `src/api/generated` with clean output.

- [ ] **Step 3: Confirm the hooks exist**

Run:
```bash
ls src/api/generated/hooks | grep -iE "Subscription"
```
Expected: `useGetSubscription.ts`, `useCheckoutSubscription.ts`, `useSwitchSubscriptionInterval.ts`, `useCancelSubscription.ts`.

Inspect the exact mutation-variable shape for the three mutations (open each hook and read the `useMutation<..., { id, data }, ...>` generic). Note whether `cancel` takes `{ id }` or `{ id, data }`. Record the exact shapes in your report — later tasks must match them verbatim.

- [ ] **Step 4: Verify**

Run: `npm run typecheck`
Expected: 0 errors (generated code is self-consistent; nothing consumes it yet).

- [ ] **Step 5: Commit**

```bash
git add api.json src/api/generated
git commit -m "chore(api): regenerate hooks with Stripe subscription endpoints"
```

---

### Task 3: Subscription error messages

**Files:**
- Modify: `src/components/contexts/context-errors.ts`
- Test: `src/components/contexts/context-errors.test.tsx`

**Interfaces:**
- Consumes: `ApiError` codes `SUB-T0001..SUB-T0006` (from Plan A). Produces: pt-BR messages via the existing `contextErrorMessage(err)`.

- [ ] **Step 1: Write the failing test**

Add to `src/components/contexts/context-errors.test.tsx`:

```ts
  it("maps subscription codes", () => {
    expect(contextErrorMessage(new ApiError(409, "SUB-T0003"))).toMatch(/já.*assinatura|já assinado/i);
    expect(contextErrorMessage(new ApiError(409, "SUB-T0004"))).toMatch(/nenhuma assinatura/i);
    expect(contextErrorMessage(new ApiError(503, "SUB-T0002"))).toMatch(/indispon/i);
    expect(contextErrorMessage(new ApiError(502, "SUB-T0005"))).toMatch(/pagamento/i);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- context-errors`
Expected: FAIL (falls back to "Algo deu errado" for the new codes).

- [ ] **Step 3: Add the messages**

In `src/components/contexts/context-errors.ts`, add to the `MESSAGES` map:

```ts
  "SUB-T0001": "Plano indisponível no momento.",
  "SUB-T0002": "Pagamentos indisponíveis no momento.",
  "SUB-T0003": "Este contexto já possui uma assinatura ativa.",
  "SUB-T0004": "Nenhuma assinatura ativa encontrada.",
  "SUB-T0005": "Falha no pagamento. Tente novamente.",
  "SUB-T0006": "O contexto não possui um dono para a cobrança.",
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- context-errors`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/contexts/context-errors.ts src/components/contexts/context-errors.test.tsx
git commit -m "feat(sub): pt-BR messages for SUB error codes"
```

---

### Task 4: Entitlement primitives (`useEntitlements`, `useEntitlement`, `<PaywallGate>`)

**Files:**
- Create: `src/hooks/use-entitlements.ts`
- Create: `src/components/subscription/paywall-gate.tsx`
- Test: `src/hooks/use-entitlements.test.tsx`
- Test: `src/components/subscription/paywall-gate.test.tsx`

**Interfaces:**
- Consumes: `useGetSubscription` (Task 2), `useHouseholdStore`.
- Produces:
  - `type EntitlementFeature = "aiInsights" | "futureProjection" | "unlimitedContexts"`
  - `useEntitlements(): { plan: "free"|"premium"; isPremium: boolean; entitlements: Entitlements; isLoading: boolean }` (defaults to free entitlements while loading / no household)
  - `useEntitlement(feature: EntitlementFeature): boolean`
  - `<PaywallGate feature title? children>` — renders children when entitled; else a locked CTA card routing to `/(tabs)/settings/plan`.

- [ ] **Step 1: Write the failing tests**

`src/hooks/use-entitlements.test.tsx`:

```tsx
import { renderHook } from "@testing-library/react-native";
import { useEntitlements } from "./use-entitlements";

const mockData: { data: unknown; isLoading: boolean } = { data: undefined, isLoading: false };
jest.mock("@/api/generated", () => ({ useGetSubscription: () => mockData }));
jest.mock("@/stores/household-store", () => ({ useHouseholdStore: (sel: (s: unknown) => unknown) => sel({ activeHouseholdId: "hh-1" }) }));

describe("useEntitlements", () => {
  it("defaults to free when no data", () => {
    mockData.data = undefined;
    const { result } = renderHook(() => useEntitlements());
    expect(result.current.isPremium).toBe(false);
    expect(result.current.entitlements.aiInsights).toBe(false);
  });
  it("reports premium from subscription data", () => {
    mockData.data = { plan: "premium", entitlements: { aiInsights: true, futureProjection: true, unlimitedContexts: true, maxContexts: 9999 } };
    const { result } = renderHook(() => useEntitlements());
    expect(result.current.isPremium).toBe(true);
    expect(result.current.entitlements.aiInsights).toBe(true);
  });
});
```

`src/components/subscription/paywall-gate.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import { PaywallGate } from "./paywall-gate";
import { Text } from "@/components/ui/text";

let premium = false;
jest.mock("@/hooks/use-entitlements", () => ({
  useEntitlement: () => premium,
}));

describe("PaywallGate", () => {
  it("renders children when entitled", () => {
    premium = true;
    render(<PaywallGate feature="aiInsights"><Text>SECRET</Text></PaywallGate>);
    expect(screen.getByText("SECRET")).toBeTruthy();
  });
  it("renders a locked CTA when not entitled", () => {
    premium = false;
    render(<PaywallGate feature="aiInsights" title="IA"><Text>SECRET</Text></PaywallGate>);
    expect(screen.queryByText("SECRET")).toBeNull();
    expect(screen.getByText(/Premium/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test -- use-entitlements paywall-gate`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the hook**

`src/hooks/use-entitlements.ts`:

```ts
import { useGetSubscription } from "@/api/generated";
import { useHouseholdStore } from "@/stores/household-store";

export type Entitlements = {
  aiInsights: boolean;
  futureProjection: boolean;
  unlimitedContexts: boolean;
  maxContexts: number;
};
export type EntitlementFeature = "aiInsights" | "futureProjection" | "unlimitedContexts";

const FREE: Entitlements = { aiInsights: false, futureProjection: false, unlimitedContexts: false, maxContexts: 2 };

export function useEntitlements() {
  const householdId = useHouseholdStore((s) => s.activeHouseholdId);
  const { data, isLoading } = useGetSubscription(householdId ?? undefined, {
    query: { enabled: Boolean(householdId) },
  });
  const sub = data as { plan?: "free" | "premium"; entitlements?: Entitlements } | undefined;
  const plan = sub?.plan ?? "free";
  return {
    plan,
    isPremium: plan === "premium",
    entitlements: sub?.entitlements ?? FREE,
    isLoading,
  };
}

export function useEntitlement(feature: EntitlementFeature): boolean {
  return useEntitlements().entitlements[feature];
}
```

> Confirm the `useGetSubscription(id, options)` signature matches the generated hook (query hooks in this repo take `(pathParam, { query })` — see `useListInvitations`). Adjust the call to the exact generated shape if it differs, keeping the return contract identical.

- [ ] **Step 4: Implement the gate**

`src/components/subscription/paywall-gate.tsx`:

```tsx
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useEntitlement, type EntitlementFeature } from "@/hooks/use-entitlements";

export function PaywallGate({
  feature,
  title,
  children,
}: {
  feature: EntitlementFeature;
  title?: string;
  children: ReactNode;
}) {
  const entitled = useEntitlement(feature);
  const router = useRouter();
  if (entitled) return <>{children}</>;
  return (
    <Card className="gap-3">
      <Text variant="title">{title ?? "Recurso Premium"}</Text>
      <Text className="text-fg-secondary">Assine o Premium para desbloquear este recurso.</Text>
      <Button label="Ver planos" onPress={() => router.push("/(tabs)/settings/plan")} />
    </Card>
  );
}
```

- [ ] **Step 5: Run to verify they pass**

Run: `npm run test -- use-entitlements paywall-gate`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/use-entitlements.ts src/components/subscription/paywall-gate.tsx src/hooks/use-entitlements.test.tsx src/components/subscription/paywall-gate.test.tsx
git commit -m "feat(sub): entitlement primitives (useEntitlements, useEntitlement, PaywallGate)"
```

---

### Task 5: `usePaymentSheetCheckout` — checkout mutation → PaymentSheet

**Files:**
- Create: `src/hooks/use-payment-sheet-checkout.ts`
- Test: `src/hooks/use-payment-sheet-checkout.test.tsx`

**Interfaces:**
- Consumes: `useCheckoutSubscription` (Task 2), `useStripe` (mocked in jest), `useHouseholdStore`, `useQueryClient`.
- Produces:
  - `usePaymentSheetCheckout(): { subscribe(interval): Promise<{ ok: boolean; canceled?: boolean; error?: string }>; isBusy: boolean }`
  - On success it invalidates the `getSubscription` query so the screen refetches.

- [ ] **Step 1: Write the failing test**

`src/hooks/use-payment-sheet-checkout.test.tsx`:

```tsx
import { renderHook, act } from "@testing-library/react-native";
import { usePaymentSheetCheckout } from "./use-payment-sheet-checkout";

const checkoutMutate = jest.fn();
const initPaymentSheet = jest.fn().mockResolvedValue({ error: undefined });
const presentPaymentSheet = jest.fn().mockResolvedValue({ error: undefined });
const invalidateQueries = jest.fn();

jest.mock("@/api/generated", () => ({ useCheckoutSubscription: () => ({ mutateAsync: checkoutMutate }) }));
jest.mock("@stripe/stripe-react-native", () => ({ useStripe: () => ({ initPaymentSheet, presentPaymentSheet }) }));
jest.mock("@/stores/household-store", () => ({ useHouseholdStore: (sel: (s: unknown) => unknown) => sel({ activeHouseholdId: "hh-1" }) }));
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries }) }));

describe("usePaymentSheetCheckout", () => {
  beforeEach(() => jest.clearAllMocks());
  it("runs checkout, inits + presents the sheet, invalidates on success", async () => {
    checkoutMutate.mockResolvedValue({ paymentIntentClientSecret: "pi_x", ephemeralKeySecret: "ek_x", customerId: "cus_x", publishableKey: "pk_x" });
    const { result } = renderHook(() => usePaymentSheetCheckout());
    let out: { ok: boolean } | undefined;
    await act(async () => { out = await result.current.subscribe("monthly"); });
    expect(checkoutMutate).toHaveBeenCalledWith({ id: "hh-1", data: { interval: "monthly" } });
    expect(initPaymentSheet).toHaveBeenCalled();
    expect(presentPaymentSheet).toHaveBeenCalled();
    expect(invalidateQueries).toHaveBeenCalled();
    expect(out?.ok).toBe(true);
  });
  it("returns canceled when the user dismisses the sheet", async () => {
    checkoutMutate.mockResolvedValue({ paymentIntentClientSecret: "pi_x", ephemeralKeySecret: "ek_x", customerId: "cus_x", publishableKey: "pk_x" });
    presentPaymentSheet.mockResolvedValueOnce({ error: { code: "Canceled", message: "canceled" } });
    const { result } = renderHook(() => usePaymentSheetCheckout());
    let out: { ok: boolean; canceled?: boolean } | undefined;
    await act(async () => { out = await result.current.subscribe("monthly"); });
    expect(out?.ok).toBe(false);
    expect(out?.canceled).toBe(true);
    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- use-payment-sheet-checkout`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the hook**

`src/hooks/use-payment-sheet-checkout.ts`:

```ts
import { useStripe } from "@stripe/stripe-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useCheckoutSubscription } from "@/api/generated";
import { contextErrorMessage } from "@/components/contexts/context-errors";
import { useHouseholdStore } from "@/stores/household-store";

type BillingInterval = "monthly" | "annual";
type Result = { ok: boolean; canceled?: boolean; error?: string };

export function usePaymentSheetCheckout() {
  const householdId = useHouseholdStore((s) => s.activeHouseholdId);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const checkout = useCheckoutSubscription();
  const queryClient = useQueryClient();
  const [isBusy, setIsBusy] = useState(false);

  async function subscribe(interval: BillingInterval): Promise<Result> {
    if (!householdId) return { ok: false, error: "Selecione um contexto primeiro." };
    setIsBusy(true);
    try {
      const session = await checkout.mutateAsync({ id: householdId, data: { interval } });
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "Finance",
        customerId: session.customerId,
        customerEphemeralKeySecret: session.ephemeralKeySecret,
        paymentIntentClientSecret: session.paymentIntentClientSecret ?? "",
        allowsDelayedPaymentMethods: false,
        returnURL: "financeapp://stripe-redirect",
      });
      if (initError) return { ok: false, error: initError.message };
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        const canceled = presentError.code === "Canceled";
        return { ok: false, canceled, error: canceled ? undefined : presentError.message };
      }
      await queryClient.invalidateQueries();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: contextErrorMessage(e) };
    } finally {
      setIsBusy(false);
    }
  }

  return { subscribe, isBusy };
}
```

> If the generated `useCheckoutSubscription` exposes `mutateAsync` with a different variable shape than `{ id, data }`, adjust the call to match the shape you recorded in Task 2 — keep the returned `Result` contract identical.

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- use-payment-sheet-checkout`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-payment-sheet-checkout.ts src/hooks/use-payment-sheet-checkout.test.tsx
git commit -m "feat(sub): usePaymentSheetCheckout (checkout mutation -> PaymentSheet)"
```

---

### Task 6: Plan screen (subscribe + manage portal)

**Files:**
- Create: `src/components/subscription/plan-comparison.tsx`
- Create: `src/app/(tabs)/settings/plan.tsx`
- Test: `src/app/(tabs)/settings/plan.test.tsx`

**Interfaces:**
- Consumes: `useEntitlements` (Task 4), `usePaymentSheetCheckout` (Task 5), `useGetSubscription`/`useSwitchSubscriptionInterval`/`useCancelSubscription` (Task 2), `useHouseholdStore`, UI kit, `contextErrorMessage`.
- Produces: the `/(tabs)/settings/plan` route — free users see plan comparison + interval `Segmented` + "Assinar"; premium users see current plan/interval/renewal + switch interval + cancel (with a `Sheet` confirmation), and a "acesso até <data>" note when `cancelAtPeriodEnd`.

- [ ] **Step 1: Write the failing test**

`src/app/(tabs)/settings/plan.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import PlanScreen from "./plan";

const subscribe = jest.fn().mockResolvedValue({ ok: true });
const switchMutate = jest.fn();
const cancelMutate = jest.fn();
let subData: unknown = { plan: "free", status: "active", currentPeriodEnd: null, cancelAtPeriodEnd: false, interval: null, entitlements: { aiInsights: false, futureProjection: false, unlimitedContexts: false, maxContexts: 2 } };

jest.mock("@/stores/household-store", () => ({ useHouseholdStore: (sel: (s: unknown) => unknown) => sel({ activeHouseholdId: "hh-1" }) }));
jest.mock("@/api/generated", () => ({
  useGetSubscription: () => ({ data: subData, isLoading: false, refetch: jest.fn() }),
  useSwitchSubscriptionInterval: () => ({ mutate: switchMutate, isPending: false }),
  useCancelSubscription: () => ({ mutate: cancelMutate, isPending: false }),
}));
jest.mock("@/hooks/use-payment-sheet-checkout", () => ({ usePaymentSheetCheckout: () => ({ subscribe, isBusy: false }) }));

describe("PlanScreen", () => {
  beforeEach(() => jest.clearAllMocks());
  it("free user can subscribe monthly", async () => {
    subData = { plan: "free", status: "active", currentPeriodEnd: null, cancelAtPeriodEnd: false, interval: null, entitlements: { aiInsights: false, futureProjection: false, unlimitedContexts: false, maxContexts: 2 } };
    render(<PlanScreen />);
    fireEvent.press(screen.getByText(/Assinar/i));
    await waitFor(() => expect(subscribe).toHaveBeenCalledWith("monthly"));
  });
  it("premium user sees manage actions", () => {
    subData = { plan: "premium", status: "active", currentPeriodEnd: "2099-01-01T00:00:00.000Z", cancelAtPeriodEnd: false, interval: "monthly", entitlements: { aiInsights: true, futureProjection: true, unlimitedContexts: true, maxContexts: 9999 } };
    render(<PlanScreen />);
    expect(screen.getByText(/Premium/i)).toBeTruthy();
    expect(screen.getByText(/Cancelar/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- settings/plan`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the plan-comparison component**

`src/components/subscription/plan-comparison.tsx`:

```tsx
import { View } from "react-native";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";

const FEATURES = [
  "Insights com IA",
  "Projeção financeira futura",
  "Contextos ilimitados",
];

export function PlanComparison() {
  return (
    <Card className="gap-3">
      <Text variant="title">Premium</Text>
      <Text className="text-fg-secondary">Desbloqueie tudo do Finance:</Text>
      <View className="gap-2">
        {FEATURES.map((f) => (
          <View key={f} className="flex-row items-center gap-2">
            <Text className="text-accent">✓</Text>
            <Text>{f}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
```

- [ ] **Step 4: Implement the screen**

`src/app/(tabs)/settings/plan.tsx`:

```tsx
import { useState } from "react";
import { Alert, View } from "react-native";
import { useCancelSubscription, useGetSubscription, useSwitchSubscriptionInterval } from "@/api/generated";
import { contextErrorMessage } from "@/components/contexts/context-errors";
import { PlanComparison } from "@/components/subscription/plan-comparison";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Text } from "@/components/ui/text";
import { usePaymentSheetCheckout } from "@/hooks/use-payment-sheet-checkout";
import { useHouseholdStore } from "@/stores/household-store";

type Interval = "monthly" | "annual";
const INTERVALS: { value: Interval; label: string }[] = [
  { value: "monthly", label: "Mensal" },
  { value: "annual", label: "Anual" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
}

export default function PlanScreen() {
  const householdId = useHouseholdStore((s) => s.activeHouseholdId);
  const { data, refetch } = useGetSubscription(householdId ?? undefined, {
    query: { enabled: Boolean(householdId) },
  });
  const sub = data as
    | { plan: "free" | "premium"; status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; interval: Interval | null }
    | undefined;

  const { subscribe, isBusy } = usePaymentSheetCheckout();
  const switchInterval = useSwitchSubscriptionInterval();
  const cancel = useCancelSubscription();
  const [interval, setInterval] = useState<Interval>("monthly");
  const [error, setError] = useState<string | null>(null);

  const isPremium = sub?.plan === "premium";

  async function onSubscribe() {
    setError(null);
    const res = await subscribe(interval);
    if (res.ok) void refetch();
    else if (!res.canceled && res.error) setError(res.error);
  }

  function onSwitch(next: Interval) {
    if (!householdId) return;
    setError(null);
    switchInterval.mutate(
      { id: householdId, data: { interval: next } },
      { onSuccess: () => void refetch(), onError: (e: unknown) => setError(contextErrorMessage(e)) },
    );
  }

  function onCancel() {
    if (!householdId) return;
    Alert.alert("Cancelar assinatura", "Você manterá o acesso até o fim do período pago. Confirmar?", [
      { text: "Voltar", style: "cancel" },
      {
        text: "Cancelar assinatura",
        style: "destructive",
        onPress: () =>
          cancel.mutate(
            { id: householdId },
            { onSuccess: () => void refetch(), onError: (e: unknown) => setError(contextErrorMessage(e)) },
          ),
      },
    ]);
  }

  return (
    <View className="flex-1 gap-4 bg-bg p-5">
      <Text variant="title">Plano</Text>

      {!isPremium ? (
        <>
          <PlanComparison />
          <View className="gap-2">
            <Text variant="label">Ciclo de cobrança</Text>
            <Segmented options={INTERVALS} value={interval} onChange={setInterval} />
          </View>
          <Button label="Assinar Premium" loading={isBusy} onPress={onSubscribe} />
        </>
      ) : (
        <>
          <Card className="gap-2">
            <Text variant="title">Premium</Text>
            <Text className="text-fg-secondary">
              {sub?.interval === "annual" ? "Cobrança anual" : "Cobrança mensal"}
            </Text>
            {sub?.currentPeriodEnd ? (
              <Text className="text-fg-secondary">
                {sub.cancelAtPeriodEnd
                  ? `Acesso até ${formatDate(sub.currentPeriodEnd)}`
                  : `Renova em ${formatDate(sub.currentPeriodEnd)}`}
              </Text>
            ) : null}
          </Card>

          {!sub?.cancelAtPeriodEnd ? (
            <>
              <View className="gap-2">
                <Text variant="label">Mudar ciclo</Text>
                <Segmented
                  options={INTERVALS}
                  value={sub?.interval ?? "monthly"}
                  onChange={onSwitch}
                />
              </View>
              <Button label="Cancelar assinatura" variant="danger" loading={cancel.isPending} onPress={onCancel} />
            </>
          ) : null}
        </>
      )}

      {error ? <Text className="text-expense">{error}</Text> : null}
    </View>
  );
}
```

> Match the exact generated mutation-variable shape from Task 2 (`{ id }` vs `{ id, data }` for cancel; `{ id, data: { interval } }` for switch). The test mocks the hooks, so the screen test passes regardless, but the real call must match — verify against Task 2's recorded shapes.

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test -- settings/plan`
Expected: PASS (both cases).

- [ ] **Step 6: Commit**

```bash
git add src/components/subscription/plan-comparison.tsx "src/app/(tabs)/settings/plan.tsx" "src/app/(tabs)/settings/plan.test.tsx"
git commit -m "feat(sub): plan screen (subscribe via PaymentSheet + manage portal)"
```

---

### Task 7: Settings hub + tab (make plan reachable)

The `settings/` screens (`members`, `contexts`, `theme`, and now `plan`) are currently orphaned — no navigation reaches them. Add a minimal settings hub + tab so the plan screen (and the existing screens) are reachable.

**Files:**
- Create: `src/app/(tabs)/settings/_layout.tsx` (Stack for the sub-screens)
- Create: `src/app/(tabs)/settings/index.tsx` (hub with list rows)
- Modify: `src/app/(tabs)/_layout.tsx` (register the settings tab)
- Test: `src/app/(tabs)/settings/index.test.tsx`

**Interfaces:**
- Consumes: `ListRow` (`@/components/ui/list-row`), expo-router `Link`/`useRouter`.
- Produces: a "settings" tab → hub screen linking to `/(tabs)/settings/plan|members|contexts|theme`.

- [ ] **Step 1: Write the failing test**

`src/app/(tabs)/settings/index.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
import SettingsHub from "./index";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

describe("SettingsHub", () => {
  it("lists the settings entries incl. Plano", () => {
    render(<SettingsHub />);
    expect(screen.getByText("Plano")).toBeTruthy();
    expect(screen.getByText("Membros")).toBeTruthy();
    expect(screen.getByText("Tema")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- settings/index`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the Stack layout**

`src/app/(tabs)/settings/_layout.tsx`:

```tsx
import { Stack } from "expo-router";

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: "Ajustes", headerShown: false }} />
      <Stack.Screen name="plan" options={{ title: "Plano" }} />
      <Stack.Screen name="members" options={{ title: "Membros" }} />
      <Stack.Screen name="contexts" options={{ title: "Contextos" }} />
      <Stack.Screen name="theme" options={{ title: "Tema" }} />
    </Stack>
  );
}
```

- [ ] **Step 4: Implement the hub**

`src/app/(tabs)/settings/index.tsx`:

```tsx
import { useRouter } from "expo-router";
import { View } from "react-native";
import { ListRow } from "@/components/ui/list-row";
import { Text } from "@/components/ui/text";

const ENTRIES: { label: string; route: string }[] = [
  { label: "Plano", route: "/(tabs)/settings/plan" },
  { label: "Membros", route: "/(tabs)/settings/members" },
  { label: "Contextos", route: "/(tabs)/settings/contexts" },
  { label: "Tema", route: "/(tabs)/settings/theme" },
];

export default function SettingsHub() {
  const router = useRouter();
  return (
    <View className="flex-1 gap-2 bg-bg p-5">
      <Text variant="title">Ajustes</Text>
      {ENTRIES.map((e) => (
        <ListRow key={e.route} title={e.label} onPress={() => router.push(e.route)} />
      ))}
    </View>
  );
}
```

> Read `src/components/ui/list-row.tsx` first and match its actual prop names (this plan assumes `title` + `onPress`; if the component uses `label`/`right`/`onPress` differently, adapt the call and the test's query text accordingly).

- [ ] **Step 5: Register the settings tab**

In `src/app/(tabs)/_layout.tsx`, add a fourth `<Tabs.Screen>` after `insights`:

```tsx
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs:settings"),
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⚙</Text>,
        }}
      />
```

Add the `tabs:settings` key to the i18n bundle if `t("tabs:settings")` resolves to a missing key (check `src/lib/i18n` / locale files; if tab titles are keyed under `tabs`, add `"settings": "Ajustes"` to each locale's `tabs` namespace). If the other tabs use literal strings elsewhere, match that; otherwise use `t("tabs:settings")` with the key added.

- [ ] **Step 6: Run to verify it passes**

Run: `npm run test -- settings/index`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(tabs)/settings/_layout.tsx" "src/app/(tabs)/settings/index.tsx" "src/app/(tabs)/settings/index.test.tsx" "src/app/(tabs)/_layout.tsx" src/lib/i18n
git commit -m "feat(settings): settings hub + tab (reaches plan/members/contexts/theme)"
```

---

### Task 8: Full verification + build gate

**Files:** none (verification only).

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 2: Full test suite**

Run: `npm run test`
Expected: all suites pass (including the new subscription tests and the untouched existing suite).

- [ ] **Step 3: Headless export (build gate)**

Run: `npx expo export --platform ios --output-dir /tmp/finance-export-check` (or the platform the repo uses; `npx expo export` with no platform exports web).
Expected: exit 0, no bundling errors. (This proves the Stripe import + provider + new screens bundle cleanly. It does NOT exercise native PaymentSheet — that requires a dev build on a device/simulator; note that as the manual QA step below.)

- [ ] **Step 4: Commit any lockfile/config churn (if the export produced none, skip)**

```bash
git add -A && git commit -m "chore(sub): frontend subscription verification" || echo "nothing to commit"
```

- [ ] **Step 5: Manual QA note (cannot be automated here)**

Record in the report: real PaymentSheet requires `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` set + backend `STRIPE_*` env + a **dev/custom build** (`npx expo run:ios` / `run:android`) on a device/simulator with a Stripe test card. Expo Go cannot load the native module. This device flow is the only way to verify the end-to-end subscribe.

---

## Self-Review

**Spec coverage (vs `2026-07-13-subscription-stripe-design.md` Frontend section):**
- `@stripe/stripe-react-native` + `<StripeProvider>` → Task 1. ✅
- Regenerate Kubb hooks → Task 2. ✅
- `initPaymentSheet`/`presentPaymentSheet` subscribe flow → Task 5 (inputs = checkout response: clientSecret + ephemeralKey + customerId). ✅
- `plan.tsx` = subscribe + manage portal (switch interval, cancel-at-period-end, "acesso até") → Task 6. ✅
- `useEntitlements` / `useEntitlement` / `<PaywallGate>` → Task 4. ✅
- Error surfacing via codes → Task 3 + `contextErrorMessage` usage in Tasks 5/6. ✅
- Reachability (spec implied a settings route) → Task 7 (hub + tab; also un-orphans existing screens — a focused improvement to code being worked in). ✅
- Gating a live premium surface (insights) → NOT included as a task; PaywallGate is delivered + tested as a reusable primitive. Wiring it into the insights screen is a documented follow-up (avoids modifying the insights screen/tests in this plan). Flag for the reviewer.

**Placeholder scan:** No "TBD"/"add error handling". Three tasks (2, 4, 6, 7) carry explicit "confirm the generated shape / read the component's real props and adapt" instructions — these are inspection steps against generated/existing code the plan cannot see, not missing content.

**Type consistency:** `Interval`/`BillingInterval` = `"monthly"|"annual"` throughout. `useEntitlements` return shape identical in Task 4 def and Task 6 use. `usePaymentSheetCheckout().subscribe(interval)` signature consistent Tasks 5↔6. Hook names (`useGetSubscription`, `useCheckoutSubscription`, `useSwitchSubscriptionInterval`, `useCancelSubscription`) consistent Tasks 2/4/5/6.

**Known risk to watch during execution:** the exact generated mutation-variable shape (`{ id, data }` vs positional) is asserted from the repo convention (`useUpdateMemberRole`) but MUST be confirmed in Task 2 and threaded verbatim into Tasks 5/6 — a mismatch is the most likely integration break.
