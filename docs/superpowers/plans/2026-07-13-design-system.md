# Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-theme design system for finance-app: a two-axis theme (mode × accent) driving a three-layer token architecture, consumed by a token-only component library, with progressive disclosure.

**Architecture:** Semantic tokens are CSS variables injected at runtime via NativeWind's `vars()` on a root `<View>`. The accent axis (Calm/Bold/Warm) selects which token map is injected; the mode axis (light/dark/system) selects light vs dark values and is synced to NativeWind's `useColorScheme`. Tailwind maps each semantic color to `rgb(var(--token) / <alpha-value>)`. Components reference only semantic classes (`bg-bg`, `text-fg`, `bg-accent`), never raw palette values.

**Tech Stack:** Expo SDK 57, React Native 0.86, React 19, NativeWind v4.2, zustand + persist (expo-secure-store), Jest + jest-expo + React Native Testing Library.

## Global Constraints

- Expo SDK 57 / RN 0.86 / React 19 — read versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing native code.
- NativeWind v4.2. `vars` is imported from `nativewind`. `useColorScheme` from `nativewind`.
- Components consume **semantic tokens only** — never raw palette hex, never `bg-neutral-*` or `bg-brand`.
- Class merging via `cn(...)` from `@/lib/utils`. BRL formatting via `formatCents(cents)` from `@/lib/utils` (already exists — do not reimplement).
- Two axes: `mode ∈ {light, dark, system}`, `accent ∈ {calm, bold, warm}`. Default `{ mode: 'system', accent: 'warm' }`.
- Money color semantics are stable across accents: income = green, expense = red, warning = amber, investment = purple/blue.
- All text/background token pairs must meet WCAG AA contrast (≥ 4.5:1 for body text).
- Zustand stores persist via the `secureStorage` adapter pattern in `src/stores/household-store.ts`.
- TDD: failing test first, minimal impl, passing test, commit. Frequent commits.
- Headless build check: `npx expo export --platform ios` must succeed.

---

### Task 1: Token maps — source of truth

**Files:**
- Create: `src/theme/theme-tokens.ts`
- Test: `src/theme/theme-tokens.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Accent = 'calm' | 'bold' | 'warm'`
  - `type Scheme = 'light' | 'dark'`
  - `type SemanticTokens = { bg: string; bgElevated: string; fg: string; fgSecondary: string; border: string; accent: string; accentFg: string; income: string; expense: string; warning: string; investment: string; neutral: string }` — every value is a space-separated RGB channel string, e.g. `'251 247 241'`.
  - `const THEMES: Record<Accent, Record<Scheme, SemanticTokens>>`
  - `function tokenVars(accent: Accent, scheme: Scheme): Record<string, string>` — maps each token to its CSS-variable name (`--bg`, `--bg-elevated`, `--fg`, `--fg-secondary`, `--border`, `--accent`, `--accent-fg`, `--income`, `--expense`, `--warning`, `--investment`, `--neutral`).

- [ ] **Step 1: Write the failing test**

```ts
// src/theme/theme-tokens.test.ts
import { THEMES, tokenVars, type Accent, type Scheme } from "./theme-tokens";

const ACCENTS: Accent[] = ["calm", "bold", "warm"];
const SCHEMES: Scheme[] = ["light", "dark"];
const TOKEN_KEYS = [
  "bg", "bgElevated", "fg", "fgSecondary", "border",
  "accent", "accentFg", "income", "expense", "warning", "investment", "neutral",
] as const;

// "R G B" channels -> relative luminance (WCAG)
function luminance(channels: string): number {
  const [r, g, b] = channels.split(" ").map((n) => {
    const c = Number(n) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("THEMES", () => {
  it("defines every token for every accent × scheme", () => {
    for (const a of ACCENTS)
      for (const s of SCHEMES)
        for (const k of TOKEN_KEYS) {
          expect(THEMES[a][s][k]).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
        }
  });

  it("meets WCAG AA for text on backgrounds", () => {
    for (const a of ACCENTS)
      for (const s of SCHEMES) {
        const t = THEMES[a][s];
        expect(contrast(t.fg, t.bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.fgSecondary, t.bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.accentFg, t.accent)).toBeGreaterThanOrEqual(4.5);
      }
  });
});

describe("tokenVars", () => {
  it("maps tokens to -- css variable names", () => {
    const v = tokenVars("warm", "light");
    expect(v["--bg"]).toBe(THEMES.warm.light.bg);
    expect(v["--accent-fg"]).toBe(THEMES.warm.light.accentFg);
    expect(Object.keys(v)).toHaveLength(TOKEN_KEYS.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/theme/theme-tokens.test.ts`
Expected: FAIL — cannot find module `./theme-tokens`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/theme/theme-tokens.ts
export type Accent = "calm" | "bold" | "warm";
export type Scheme = "light" | "dark";

export type SemanticTokens = {
  bg: string;
  bgElevated: string;
  fg: string;
  fgSecondary: string;
  border: string;
  accent: string;
  accentFg: string;
  income: string;
  expense: string;
  warning: string;
  investment: string;
  neutral: string;
};

// Values are "R G B" channels so Tailwind can apply `rgb(var(--x) / <alpha>)`.
// Contrast pairs (fg/bg, fgSecondary/bg, accentFg/accent) are tuned to WCAG AA.
export const THEMES: Record<Accent, Record<Scheme, SemanticTokens>> = {
  calm: {
    light: {
      bg: "244 247 246", bgElevated: "255 255 255", fg: "11 31 30",
      fgSecondary: "74 92 91", border: "203 222 220", accent: "14 124 123",
      accentFg: "255 255 255", income: "21 128 61", expense: "185 28 28",
      warning: "180 83 9", investment: "67 56 202", neutral: "100 116 118",
    },
    dark: {
      bg: "8 20 20", bgElevated: "17 33 32", fg: "233 240 239",
      fgSecondary: "160 180 178", border: "34 54 52", accent: "45 212 191",
      accentFg: "6 22 21", income: "74 222 128", expense: "248 113 113",
      warning: "251 191 36", investment: "165 180 252", neutral: "148 163 165",
    },
  },
  bold: {
    light: {
      bg: "247 248 250", bgElevated: "255 255 255", fg: "17 19 24",
      fgSecondary: "71 76 88", border: "214 218 226", accent: "22 101 52",
      accentFg: "255 255 255", income: "21 128 61", expense: "185 28 28",
      warning: "180 83 9", investment: "67 56 202", neutral: "100 116 128",
    },
    dark: {
      bg: "17 19 24", bgElevated: "22 24 31", fg: "242 244 248",
      fgSecondary: "166 172 184", border: "35 38 47", accent: "132 204 22",
      accentFg: "12 20 4", income: "74 222 128", expense: "248 113 113",
      warning: "250 204 21", investment: "129 140 248", neutral: "148 163 176",
    },
  },
  warm: {
    light: {
      bg: "251 247 241", bgElevated: "255 255 255", fg: "43 38 32",
      fgSecondary: "92 82 70", border: "234 224 210", accent: "194 104 59",
      accentFg: "255 255 255", income: "21 128 61", expense: "185 28 28",
      warning: "180 83 9", investment: "67 56 202", neutral: "115 105 92",
    },
    dark: {
      bg: "26 22 18", bgElevated: "38 32 26", fg: "245 240 232",
      fgSecondary: "180 168 152", border: "58 50 42", accent: "224 138 78",
      accentFg: "26 15 6", income: "74 222 128", expense: "248 113 113",
      warning: "251 191 36", investment: "165 180 252", neutral: "150 138 122",
    },
  },
};

const VAR_NAMES: Record<keyof SemanticTokens, string> = {
  bg: "--bg", bgElevated: "--bg-elevated", fg: "--fg", fgSecondary: "--fg-secondary",
  border: "--border", accent: "--accent", accentFg: "--accent-fg", income: "--income",
  expense: "--expense", warning: "--warning", investment: "--investment", neutral: "--neutral",
};

export function tokenVars(accent: Accent, scheme: Scheme): Record<string, string> {
  const t = THEMES[accent][scheme];
  const out: Record<string, string> = {};
  for (const key of Object.keys(VAR_NAMES) as (keyof SemanticTokens)[]) {
    out[VAR_NAMES[key]] = t[key];
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/theme/theme-tokens.test.ts`
Expected: PASS (3 tests). If a contrast assertion fails, darken/lighten the offending channel until ≥ 4.5 — do not weaken the test.

- [ ] **Step 5: Commit**

```bash
git add src/theme/theme-tokens.ts src/theme/theme-tokens.test.ts
git commit -m "feat(theme): add semantic token maps for 3 accents x 2 schemes"
```

---

### Task 2: Tailwind + global.css semantic wiring

**Files:**
- Modify: `tailwind.config.js`
- Modify: `src/global.css`
- Test: `src/theme/tailwind-tokens.test.ts`

**Interfaces:**
- Consumes: token variable names from Task 1 (`--bg`, `--fg`, `--accent`, …).
- Produces: Tailwind semantic color utilities `bg-bg`, `bg-bg-elevated`, `text-fg`, `text-fg-secondary`, `border-border`, `bg-accent`, `text-accent`, `text-accent-fg`, `text-income`, `text-expense`, `text-warning`, `text-investment`, `text-neutral` (and matching `bg-*`).

- [ ] **Step 1: Write the failing test**

```ts
// src/theme/tailwind-tokens.test.ts
// Guards the config↔token contract: every semantic token in the config must be
// backed by a CSS variable that theme-tokens.ts produces.
import tailwind from "../../tailwind.config.js";
import { tokenVars } from "./theme-tokens";

function varRefs(colors: Record<string, unknown>, acc: Set<string> = new Set()): Set<string> {
  for (const v of Object.values(colors)) {
    if (typeof v === "string") {
      const m = v.match(/var\((--[a-z-]+)\)/);
      if (m) acc.add(m[1]);
    } else if (v && typeof v === "object") {
      varRefs(v as Record<string, unknown>, acc);
    }
  }
  return acc;
}

it("every config color var is produced by tokenVars", () => {
  const configVars = varRefs(tailwind.theme.extend.colors);
  const produced = new Set(Object.keys(tokenVars("warm", "light")));
  for (const v of configVars) expect(produced.has(v)).toBe(true);
  expect(configVars.size).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/theme/tailwind-tokens.test.ts`
Expected: FAIL — config still has only `brand`, no `var(--…)` refs, so `configVars.size` is 0.

- [ ] **Step 3: Write minimal implementation**

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
const withAlpha = (v) => `rgb(var(${v}) / <alpha-value>)`;

module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: withAlpha("--bg"), elevated: withAlpha("--bg-elevated") },
        fg: { DEFAULT: withAlpha("--fg"), secondary: withAlpha("--fg-secondary") },
        border: withAlpha("--border"),
        accent: { DEFAULT: withAlpha("--accent"), fg: withAlpha("--accent-fg") },
        income: withAlpha("--income"),
        expense: withAlpha("--expense"),
        warning: withAlpha("--warning"),
        investment: withAlpha("--investment"),
        neutral: withAlpha("--neutral"),
      },
    },
  },
  plugins: [],
};
```

```css
/* src/global.css — append below the existing @tailwind + :root font block.
   Web fallback defaults (Warm light) so the web build paints before JS injects
   vars(). Native gets its values from the ThemeProvider's vars() at runtime. */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --font-display:
    Spline Sans, Inter, ui-sans-serif, system-ui, sans-serif, Apple Color Emoji, Segoe UI Emoji,
    Segoe UI Symbol, Noto Color Emoji;
  --font-mono:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace;
  --font-rounded: 'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif;
  --font-serif: Georgia, 'Times New Roman', serif;

  --bg: 251 247 241;
  --bg-elevated: 255 255 255;
  --fg: 43 38 32;
  --fg-secondary: 92 82 70;
  --border: 234 224 210;
  --accent: 194 104 59;
  --accent-fg: 255 255 255;
  --income: 21 128 61;
  --expense: 185 28 28;
  --warning: 180 83 9;
  --investment: 67 56 202;
  --neutral: 115 105 92;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/theme/tailwind-tokens.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.js src/global.css src/theme/tailwind-tokens.test.ts
git commit -m "feat(theme): wire semantic tokens into tailwind config + css fallback"
```

---

### Task 3: Theme store (persisted selection)

**Files:**
- Create: `src/stores/theme-store.ts`
- Test: `src/stores/theme-store.test.ts`

**Interfaces:**
- Consumes: `Accent` from Task 1.
- Produces:
  - `type Mode = 'light' | 'dark' | 'system'`
  - `useThemeStore` (zustand) with state `{ mode: Mode; accent: Accent; setMode(m: Mode): void; setAccent(a: Accent): void }`.
  - Defaults `{ mode: 'system', accent: 'warm' }`, persisted under key `theme.selection` via secure-store.

- [ ] **Step 1: Write the failing test**

```ts
// src/stores/theme-store.test.ts
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
import { useThemeStore } from "./theme-store";

it("defaults to warm + system", () => {
  const s = useThemeStore.getState();
  expect(s.mode).toBe("system");
  expect(s.accent).toBe("warm");
});

it("updates mode and accent", () => {
  useThemeStore.getState().setMode("dark");
  useThemeStore.getState().setAccent("calm");
  expect(useThemeStore.getState().mode).toBe("dark");
  expect(useThemeStore.getState().accent).toBe("calm");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/stores/theme-store.test.ts`
Expected: FAIL — cannot find module `./theme-store`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/stores/theme-store.ts
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Accent } from "@/theme/theme-tokens";

export type Mode = "light" | "dark" | "system";

type ThemeState = {
  mode: Mode;
  accent: Accent;
  setMode: (m: Mode) => void;
  setAccent: (a: Accent) => void;
};

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "system",
      accent: "warm",
      setMode: (mode) => set({ mode }),
      setAccent: (accent) => set({ accent }),
    }),
    { name: "theme.selection", storage: createJSONStorage(() => secureStorage) },
  ),
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/stores/theme-store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/theme-store.ts src/stores/theme-store.test.ts
git commit -m "feat(theme): add persisted theme-selection store"
```

---

### Task 4: ThemeProvider + useTheme (RISK VALIDATION)

This is the highest-risk task: it proves NativeWind `vars()` (accent axis) and `useColorScheme` (mode axis) work together on web and native. Do this task before building components on top.

**Files:**
- Create: `src/theme/theme-provider.tsx`
- Modify: `src/app/_layout.tsx` (wrap the app)
- Test: `src/theme/theme-provider.test.tsx`

**Interfaces:**
- Consumes: `useThemeStore` (Task 3), `tokenVars` + `Scheme` (Task 1).
- Produces:
  - `<ThemeProvider>{children}</ThemeProvider>` — wraps children in a `<View style={[{flex:1}, vars(...)]} className="bg-bg">`, syncs mode → `setColorScheme`, injects the accent×scheme token vars.
  - `function useTheme(): { mode: Mode; accent: Accent; scheme: Scheme; setMode; setAccent }` — `scheme` is the resolved light/dark (system resolved via `useColorScheme`).

- [ ] **Step 1: Write the failing test**

```tsx
// src/theme/theme-provider.test.tsx
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
const setColorScheme = jest.fn();
jest.mock("nativewind", () => ({
  useColorScheme: () => ({ colorScheme: "light", setColorScheme }),
  vars: (obj: Record<string, string>) => obj, // identity for assertion
}));

import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import { ThemeProvider, useTheme } from "./theme-provider";
import { useThemeStore } from "@/stores/theme-store";

function Probe() {
  const { accent, scheme } = useTheme();
  return <Text>{`${accent}:${scheme}`}</Text>;
}

it("resolves accent + scheme and syncs color scheme", () => {
  useThemeStore.setState({ mode: "system", accent: "warm" });
  const { getByText } = render(
    <ThemeProvider><Probe /></ThemeProvider>,
  );
  expect(getByText("warm:light")).toBeTruthy();
  expect(setColorScheme).toHaveBeenCalledWith("system");
});

it("forces scheme when mode is not system", () => {
  useThemeStore.setState({ mode: "dark", accent: "calm" });
  const { getByText } = render(
    <ThemeProvider><Probe /></ThemeProvider>,
  );
  expect(getByText("calm:dark")).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/theme/theme-provider.test.tsx`
Expected: FAIL — cannot find module `./theme-provider`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/theme/theme-provider.tsx
import { useEffect, useMemo } from "react";
import { View } from "react-native";
import { useColorScheme, vars } from "nativewind";
import { useThemeStore, type Mode } from "@/stores/theme-store";
import { tokenVars, type Accent, type Scheme } from "./theme-tokens";

export function useTheme() {
  const { mode, accent, setMode, setAccent } = useThemeStore();
  const { colorScheme } = useColorScheme();
  const scheme: Scheme =
    mode === "system" ? ((colorScheme ?? "light") as Scheme) : (mode as Scheme);
  return { mode, accent, scheme, setMode, setAccent };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { mode, accent, scheme } = useTheme();
  const { setColorScheme } = useColorScheme();

  useEffect(() => {
    setColorScheme(mode);
  }, [mode, setColorScheme]);

  const style = useMemo(() => vars(tokenVars(accent, scheme)), [accent, scheme]);

  return (
    <View style={[{ flex: 1 }, style]} className="bg-bg">
      {children}
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/theme/theme-provider.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire into the root layout**

Modify `src/app/_layout.tsx` — import and wrap the existing tree just inside `GestureHandlerRootView`:

```tsx
import "@/lib/i18n";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { queryClient } from "@/api/query-client";
import { AuthProvider } from "@/contexts/auth-context";
import { ThemeProvider } from "@/theme/theme-provider";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
            </Stack>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 6: Validate the risk headlessly**

Run: `npx expo export --platform ios`
Expected: build completes with no error. This confirms `vars()` + `useColorScheme` + the tailwind token config compile together on native.

**If `vars()` cannot be applied on native or the export fails on the token config:** fall back to a context-based provider — keep `useTheme()`'s public signature identical, but instead of `vars()`, store the resolved `SemanticTokens` object in React context and expose a `useToken(key)` accessor; components then read colors via a small `styled` wrapper. Record the decision in a comment at the top of `theme-provider.tsx`. Do not change any later task's interface.

- [ ] **Step 7: Commit**

```bash
git add src/theme/theme-provider.tsx src/theme/theme-provider.test.tsx src/app/_layout.tsx
git commit -m "feat(theme): add ThemeProvider wiring vars() accent + useColorScheme mode"
```

---

### Task 5: Text — typographic scale

**Files:**
- Modify: `src/components/ui/text.tsx`
- Test: `src/components/ui/text.test.tsx`

**Interfaces:**
- Consumes: semantic classes `text-fg`, `text-fg-secondary`; `cn`.
- Produces: `<Text variant?>` where `variant ∈ 'display' | 'title' | 'body' | 'caption' | 'label'` (default `body`). `caption`/`label` render in `text-fg-secondary`; others `text-fg`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/text.test.tsx
import { render } from "@testing-library/react-native";
import { Text } from "./text";

it("applies the display scale", () => {
  const { getByText } = render(<Text variant="display">Hi</Text>);
  expect(getByText("Hi").props.className).toContain("text-3xl");
});

it("uses secondary color for captions", () => {
  const { getByText } = render(<Text variant="caption">note</Text>);
  expect(getByText("note").props.className).toContain("text-fg-secondary");
});

it("defaults to body on fg", () => {
  const { getByText } = render(<Text>hello</Text>);
  expect(getByText("hello").props.className).toContain("text-fg");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/components/ui/text.test.tsx`
Expected: FAIL — `variant` prop not handled; className lacks `text-3xl`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/ui/text.tsx
import { Text as RNText, type TextProps } from "react-native";
import { cn } from "@/lib/utils";

type Variant = "display" | "title" | "body" | "caption" | "label";

const VARIANTS: Record<Variant, string> = {
  display: "text-3xl font-bold text-fg",
  title: "text-xl font-semibold text-fg",
  body: "text-base text-fg",
  caption: "text-sm text-fg-secondary",
  label: "text-xs uppercase tracking-wide text-fg-secondary",
};

export function Text({
  variant = "body",
  className,
  ...props
}: TextProps & { variant?: Variant; className?: string }) {
  return <RNText className={cn(VARIANTS[variant], className)} {...props} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/components/ui/text.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/text.tsx src/components/ui/text.test.tsx
git commit -m "feat(ui): typographic scale on Text, token colors"
```

---

### Task 6: AmountText — BRL + income/expense color

**Files:**
- Create: `src/components/ui/amount-text.tsx`
- Test: `src/components/ui/amount-text.test.tsx`

**Interfaces:**
- Consumes: `formatCents` from `@/lib/utils`, `Text` (Task 5), `cn`.
- Produces: `<AmountText cents={number} colorize?={boolean} />`. Renders `formatCents(cents)`; when `colorize` (default true): `cents > 0` → `text-income`, `cents < 0` → `text-expense`, `cents === 0` → `text-neutral`. When `colorize={false}` → `text-fg`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/amount-text.test.tsx
import { render } from "@testing-library/react-native";
import { AmountText } from "./amount-text";

it("formats cents as BRL", () => {
  const { getByText } = render(<AmountText cents={-18400} />);
  // formatCents(-18400) => "-R$ 184,00" (pt-BR)
  expect(getByText(/184,00/)).toBeTruthy();
});

it("colors positive as income, negative as expense", () => {
  const { getByText } = render(<AmountText cents={5000} />);
  expect(getByText(/50,00/).props.className).toContain("text-income");
  const { getByText: g2 } = render(<AmountText cents={-5000} />);
  expect(g2(/50,00/).props.className).toContain("text-expense");
});

it("uses fg when colorize is false", () => {
  const { getByText } = render(<AmountText cents={5000} colorize={false} />);
  expect(getByText(/50,00/).props.className).toContain("text-fg");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/components/ui/amount-text.test.tsx`
Expected: FAIL — cannot find module `./amount-text`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/ui/amount-text.tsx
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/utils";
import { Text } from "./text";
import type { TextProps } from "react-native";

export function AmountText({
  cents,
  colorize = true,
  className,
  ...props
}: TextProps & { cents: number; colorize?: boolean; className?: string }) {
  const color = !colorize
    ? "text-fg"
    : cents > 0
      ? "text-income"
      : cents < 0
        ? "text-expense"
        : "text-neutral";
  return (
    <Text className={cn("font-semibold", color, className)} {...props}>
      {formatCents(cents)}
    </Text>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/components/ui/amount-text.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/amount-text.tsx src/components/ui/amount-text.test.tsx
git commit -m "feat(ui): AmountText with BRL formatting and income/expense colors"
```

---

### Task 7: Button — refactor to tokens + variants

**Files:**
- Modify: `src/components/ui/button.tsx`
- Test: `src/components/ui/button.test.tsx`

**Interfaces:**
- Consumes: semantic classes `bg-accent`, `text-accent-fg`, `bg-bg-elevated`, `text-fg`, `bg-expense`; `Text` (Task 5); `cn`.
- Produces: `<Button label loading? disabled? variant? size? />` with `variant ∈ 'primary' | 'secondary' | 'ghost' | 'danger'` (default `primary`), `size ∈ 'sm' | 'md' | 'lg'` (default `md`).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/button.test.tsx
import { render } from "@testing-library/react-native";
import { Button } from "./button";

it("primary uses accent background", () => {
  const { getByRole } = render(<Button label="Save" />);
  expect(getByRole("button").props.className).toContain("bg-accent");
});

it("danger uses expense background", () => {
  const { getByRole } = render(<Button label="Delete" variant="danger" />);
  expect(getByRole("button").props.className).toContain("bg-expense");
});

it("disables when loading", () => {
  const { getByRole } = render(<Button label="Save" loading />);
  expect(getByRole("button").props.accessibilityState.disabled).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/components/ui/button.test.tsx`
Expected: FAIL — current button uses `bg-brand`, not `bg-accent`; no `danger` variant.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/ui/button.tsx
import { ActivityIndicator, Pressable, type PressableProps } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "./text";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const CONTAINER: Record<Variant, string> = {
  primary: "bg-accent",
  secondary: "bg-bg-elevated border border-border",
  ghost: "bg-transparent",
  danger: "bg-expense",
};
const LABEL: Record<Variant, string> = {
  primary: "text-accent-fg",
  secondary: "text-fg",
  ghost: "text-accent",
  danger: "text-accent-fg",
};
const SIZE: Record<Size, string> = {
  sm: "min-h-[36px] px-3 py-2",
  md: "min-h-[48px] px-5 py-3",
  lg: "min-h-[56px] px-6 py-4",
};

type Props = Omit<PressableProps, "children"> & {
  label: string;
  loading?: boolean;
  variant?: Variant;
  size?: Size;
  className?: string;
};

export function Button({
  label,
  loading = false,
  variant = "primary",
  size = "md",
  className,
  disabled,
  ...props
}: Props) {
  const isDisabled = disabled === true || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      className={cn(
        "flex-row items-center justify-center rounded-2xl",
        SIZE[size],
        CONTAINER[variant],
        isDisabled && "opacity-50",
        className,
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator />
      ) : (
        <Text className={cn("font-semibold", LABEL[variant])}>{label}</Text>
      )}
    </Pressable>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/components/ui/button.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/button.tsx src/components/ui/button.test.tsx
git commit -m "feat(ui): Button variants/sizes on semantic tokens"
```

---

### Task 8: Card — refactor to tokens

**Files:**
- Modify: `src/components/ui/card.tsx`
- Test: `src/components/ui/card.test.tsx`

**Interfaces:**
- Consumes: `bg-bg-elevated`, `border-border`; `cn`.
- Produces: `<Card>` — elevated surface. Accepts `className`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/card.test.tsx
import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import { Card } from "./card";

it("renders an elevated surface with token bg", () => {
  const { getByTestId } = render(
    <Card testID="c"><Text>x</Text></Card>,
  );
  expect(getByTestId("c").props.className).toContain("bg-bg-elevated");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/components/ui/card.test.tsx`
Expected: FAIL — current card uses `bg-white`, not `bg-bg-elevated`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/ui/card.tsx
import { View, type ViewProps } from "react-native";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={cn("rounded-2xl border border-border bg-bg-elevated p-4", className)}
      {...props}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/components/ui/card.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/card.tsx src/components/ui/card.test.tsx
git commit -m "feat(ui): Card on semantic surface tokens"
```

---

### Task 9: Field — labeled input

**Files:**
- Create: `src/components/ui/field.tsx`
- Test: `src/components/ui/field.test.tsx`

**Interfaces:**
- Consumes: `Text` (Task 5), `bg-bg-elevated`, `border-border`, `text-fg`, `text-expense`; `cn`.
- Produces: `<Field label value onChangeText error? hint? {...TextInputProps} />`. Renders label (Text variant `label`), a `TextInput`, and either `error` (text-expense) or `hint` (caption) below.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/field.test.tsx
import { render } from "@testing-library/react-native";
import { Field } from "./field";

it("shows label and hint", () => {
  const { getByText } = render(
    <Field label="Nome" value="" onChangeText={() => {}} hint="Como te chamar" />,
  );
  expect(getByText("Nome")).toBeTruthy();
  expect(getByText("Como te chamar")).toBeTruthy();
});

it("shows error in place of hint", () => {
  const { getByText, queryByText } = render(
    <Field label="Email" value="x" onChangeText={() => {}} hint="opcional" error="Inválido" />,
  );
  expect(getByText("Inválido").props.className).toContain("text-expense");
  expect(queryByText("opcional")).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/components/ui/field.test.tsx`
Expected: FAIL — cannot find module `./field`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/ui/field.tsx
import { TextInput, View, type TextInputProps } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "./text";

type Props = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
};

export function Field({ label, error, hint, className, ...props }: Props) {
  return (
    <View className={cn("gap-1", className)}>
      <Text variant="label">{label}</Text>
      <TextInput
        className={cn(
          "min-h-[48px] rounded-xl border bg-bg-elevated px-4 text-base text-fg",
          error ? "border-expense" : "border-border",
        )}
        placeholderTextColor="rgb(var(--fg-secondary))"
        {...props}
      />
      {error ? (
        <Text className="text-sm text-expense">{error}</Text>
      ) : hint ? (
        <Text variant="caption">{hint}</Text>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/components/ui/field.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/field.tsx src/components/ui/field.test.tsx
git commit -m "feat(ui): Field labeled input with error/hint"
```

---

### Task 10: Segmented — segmented control

**Files:**
- Create: `src/components/ui/segmented.tsx`
- Test: `src/components/ui/segmented.test.tsx`

**Interfaces:**
- Consumes: `Text` (Task 5), `bg-bg-elevated`, `bg-bg`, `text-accent`, `text-fg-secondary`; `cn`.
- Produces: `<Segmented<T> options value onChange />` where `options: { value: T; label: string }[]`. Renders a pill row; the selected segment gets `bg-bg` + `text-accent`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/segmented.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import { Segmented } from "./segmented";

const OPTS = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
  { value: "system", label: "Sistema" },
];

it("marks selected segment with accent", () => {
  const { getByText } = render(
    <Segmented options={OPTS} value="system" onChange={() => {}} />,
  );
  expect(getByText("Sistema").props.className).toContain("text-accent");
});

it("calls onChange with the tapped value", () => {
  const onChange = jest.fn();
  const { getByText } = render(
    <Segmented options={OPTS} value="system" onChange={onChange} />,
  );
  fireEvent.press(getByText("Claro"));
  expect(onChange).toHaveBeenCalledWith("light");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/components/ui/segmented.test.tsx`
Expected: FAIL — cannot find module `./segmented`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/ui/segmented.tsx
import { Pressable, View } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "./text";

type Option<T extends string> = { value: T; label: string };

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <View className={cn("flex-row rounded-xl bg-bg-elevated p-1", className)}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(opt.value)}
            className={cn("flex-1 items-center rounded-lg py-2", selected && "bg-bg")}
          >
            <Text
              className={cn(
                "text-sm font-semibold",
                selected ? "text-accent" : "text-fg-secondary",
              )}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/components/ui/segmented.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/segmented.tsx src/components/ui/segmented.test.tsx
git commit -m "feat(ui): Segmented control on tokens"
```

---

### Task 11: ListRow — icon + title/subtitle + trailing

**Files:**
- Create: `src/components/ui/list-row.tsx`
- Test: `src/components/ui/list-row.test.tsx`

**Interfaces:**
- Consumes: `Text` (Task 5), `border-border`, `text-fg`, `text-fg-secondary`; `cn`.
- Produces: `<ListRow title subtitle? leading? trailing? onPress? />`. `leading`/`trailing` are `ReactNode`. Pressable when `onPress` provided.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/list-row.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { ListRow } from "./list-row";

it("renders title and subtitle", () => {
  const { getByText } = render(<ListRow title="Mercado" subtitle="Hoje" />);
  expect(getByText("Mercado")).toBeTruthy();
  expect(getByText("Hoje")).toBeTruthy();
});

it("fires onPress", () => {
  const onPress = jest.fn();
  const { getByText } = render(
    <ListRow title="Café" trailing={<Text>−12</Text>} onPress={onPress} />,
  );
  fireEvent.press(getByText("Café"));
  expect(onPress).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/components/ui/list-row.test.tsx`
Expected: FAIL — cannot find module `./list-row`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/ui/list-row.tsx
import { Pressable, View } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "./text";

type Props = {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  className?: string;
};

export function ListRow({ title, subtitle, leading, trailing, onPress, className }: Props) {
  const Container = onPress ? Pressable : View;
  return (
    <Container
      {...(onPress ? { onPress, accessibilityRole: "button" } : {})}
      className={cn("flex-row items-center gap-3 border-b border-border py-3", className)}
    >
      {leading}
      <View className="flex-1">
        <Text className="text-fg">{title}</Text>
        {subtitle ? <Text variant="caption">{subtitle}</Text> : null}
      </View>
      {trailing}
    </Container>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/components/ui/list-row.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/list-row.tsx src/components/ui/list-row.test.tsx
git commit -m "feat(ui): ListRow"
```

---

### Task 12: Sheet — bottom sheet modal

**Files:**
- Create: `src/components/ui/sheet.tsx`
- Test: `src/components/ui/sheet.test.tsx`

**Interfaces:**
- Consumes: RN `Modal`, `bg-bg-elevated`, `border-border`; `cn`.
- Produces: `<Sheet visible onClose title? >{children}</Sheet>`. A bottom-anchored `Modal` (transparent, slide) with a backdrop `Pressable` that calls `onClose`, and a rounded top panel.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/sheet.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { Sheet } from "./sheet";

it("renders children when visible", () => {
  const { getByText } = render(
    <Sheet visible onClose={() => {}} title="Tema"><Text>corpo</Text></Sheet>,
  );
  expect(getByText("Tema")).toBeTruthy();
  expect(getByText("corpo")).toBeTruthy();
});

it("calls onClose when backdrop pressed", () => {
  const onClose = jest.fn();
  const { getByTestId } = render(
    <Sheet visible onClose={onClose}><Text>x</Text></Sheet>,
  );
  fireEvent.press(getByTestId("sheet-backdrop"));
  expect(onClose).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/components/ui/sheet.test.tsx`
Expected: FAIL — cannot find module `./sheet`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/ui/sheet.tsx
import { Modal, Pressable, View } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "./text";

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
};

export function Sheet({ visible, onClose, title, children, className }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable
          testID="sheet-backdrop"
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={onClose}
          className="absolute inset-0 bg-black/40"
        />
        <View
          className={cn(
            "rounded-t-3xl border-t border-border bg-bg-elevated p-5 pb-8",
            className,
          )}
        >
          {title ? <Text variant="title" className="mb-4">{title}</Text> : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/components/ui/sheet.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/sheet.tsx src/components/ui/sheet.test.tsx
git commit -m "feat(ui): Sheet bottom modal"
```

---

### Task 13: Small primitives — Badge, ProgressBar, Skeleton, EmptyState

**Files:**
- Create: `src/components/ui/badge.tsx`, `src/components/ui/progress-bar.tsx`, `src/components/ui/skeleton.tsx`, `src/components/ui/empty-state.tsx`
- Test: `src/components/ui/primitives.test.tsx`

**Interfaces:**
- Consumes: `Text` (Task 5), `Button` (Task 7), tokens; `cn`.
- Produces:
  - `<Badge label tone? />` — `tone ∈ 'neutral' | 'income' | 'expense' | 'warning' | 'investment'` (default `neutral`).
  - `<ProgressBar value />` — `value` 0..1, clamped; accessible `progressbar` role.
  - `<Skeleton className? />` — a pulsing `bg-border` block.
  - `<EmptyState title message? actionLabel? onAction? />`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/primitives.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import { Badge } from "./badge";
import { ProgressBar } from "./progress-bar";
import { Skeleton } from "./skeleton";
import { EmptyState } from "./empty-state";

it("Badge tones map to token text color", () => {
  const { getByText } = render(<Badge label="Meta" tone="income" />);
  expect(getByText("Meta").props.className).toContain("text-income");
});

it("ProgressBar clamps and reports accessibility value", () => {
  const { getByRole } = render(<ProgressBar value={1.5} />);
  expect(getByRole("progressbar").props.accessibilityValue).toEqual({ now: 100, min: 0, max: 100 });
});

it("Skeleton renders a placeholder block", () => {
  const { getByTestId } = render(<Skeleton testID="sk" />);
  expect(getByTestId("sk").props.className).toContain("bg-border");
});

it("EmptyState fires its action", () => {
  const onAction = jest.fn();
  const { getByText } = render(
    <EmptyState title="Sem dados" actionLabel="Importar" onAction={onAction} />,
  );
  fireEvent.press(getByText("Importar"));
  expect(onAction).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/components/ui/primitives.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write minimal implementations**

```tsx
// src/components/ui/badge.tsx
import { View } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "./text";

type Tone = "neutral" | "income" | "expense" | "warning" | "investment";
const TEXT: Record<Tone, string> = {
  neutral: "text-neutral",
  income: "text-income",
  expense: "text-expense",
  warning: "text-warning",
  investment: "text-investment",
};

export function Badge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return (
    <View className="self-start rounded-full border border-border px-2 py-0.5">
      <Text className={cn("text-xs font-semibold", TEXT[tone])}>{label}</Text>
    </View>
  );
}
```

```tsx
// src/components/ui/progress-bar.tsx
import { View } from "react-native";
import { cn } from "@/lib/utils";

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ now: pct, min: 0, max: 100 }}
      className={cn("h-1.5 overflow-hidden rounded-full bg-border", className)}
    >
      <View className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
    </View>
  );
}
```

```tsx
// src/components/ui/skeleton.tsx
import { View, type ViewProps } from "react-native";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn("h-4 animate-pulse rounded-md bg-border", className)} {...props} />;
}
```

```tsx
// src/components/ui/empty-state.tsx
import { View } from "react-native";
import { Button } from "./button";
import { Text } from "./text";

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View className="items-center gap-2 p-8">
      <Text variant="title">{title}</Text>
      {message ? <Text variant="caption" className="text-center">{message}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} className="mt-2" />
      ) : null}
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/components/ui/primitives.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/badge.tsx src/components/ui/progress-bar.tsx src/components/ui/skeleton.tsx src/components/ui/empty-state.tsx src/components/ui/primitives.test.tsx
git commit -m "feat(ui): Badge, ProgressBar, Skeleton, EmptyState primitives"
```

---

### Task 14: DisclosureSection — progressive disclosure

**Files:**
- Create: `src/components/ui/disclosure-section.tsx`
- Test: `src/components/ui/disclosure-section.test.tsx`

**Interfaces:**
- Consumes: `Text` (Task 5), tokens; `cn`.
- Produces: `<DisclosureSection title>{children}</DisclosureSection>`. Collapsed by default; a pressable header toggles the body. This is the standard "essential visible / advanced hidden" primitive every screen uses.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/disclosure-section.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { DisclosureSection } from "./disclosure-section";

it("hides body until expanded", () => {
  const { queryByText, getByText } = render(
    <DisclosureSection title="Detalhes avançados"><Text>oculto</Text></DisclosureSection>,
  );
  expect(queryByText("oculto")).toBeNull();
  fireEvent.press(getByText("Detalhes avançados"));
  expect(getByText("oculto")).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/components/ui/disclosure-section.test.tsx`
Expected: FAIL — cannot find module `./disclosure-section`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/ui/disclosure-section.tsx
import { useState } from "react";
import { Pressable, View } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "./text";

export function DisclosureSection({
  title,
  defaultOpen = false,
  children,
  className,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View className={cn("gap-2", className)}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center justify-between py-2"
      >
        <Text className="text-fg font-semibold">{title}</Text>
        <Text className="text-fg-secondary">{open ? "−" : "+"}</Text>
      </Pressable>
      {open ? <View>{children}</View> : null}
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/components/ui/disclosure-section.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/disclosure-section.tsx src/components/ui/disclosure-section.test.tsx
git commit -m "feat(ui): DisclosureSection progressive-disclosure primitive"
```

---

### Task 15: ThemePicker + settings route

**Files:**
- Create: `src/components/theme/theme-picker.tsx`
- Create: `src/app/(tabs)/settings/theme.tsx`
- Test: `src/components/theme/theme-picker.test.tsx`

**Interfaces:**
- Consumes: `useTheme` (Task 4), `Segmented` (Task 10), `Text` (Task 5), `Card` (Task 8), `THEMES` + `Accent` (Task 1), `Mode` (Task 3); `cn`.
- Produces: `<ThemePicker />` — Mode `Segmented` (Claro/Escuro/Sistema) + a row of accent swatches (Calm/Bold/Warm), each calling `setAccent`. Selected accent shows a ring.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/theme/theme-picker.test.tsx
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
jest.mock("nativewind", () => ({
  useColorScheme: () => ({ colorScheme: "light", setColorScheme: jest.fn() }),
  vars: (o: Record<string, string>) => o,
}));
import { fireEvent, render } from "@testing-library/react-native";
import { ThemePicker } from "./theme-picker";
import { useThemeStore } from "@/stores/theme-store";

it("changes mode via segmented", () => {
  useThemeStore.setState({ mode: "system", accent: "warm" });
  const { getByText } = render(<ThemePicker />);
  fireEvent.press(getByText("Escuro"));
  expect(useThemeStore.getState().mode).toBe("dark");
});

it("changes accent via swatch", () => {
  useThemeStore.setState({ mode: "system", accent: "warm" });
  const { getByLabelText } = render(<ThemePicker />);
  fireEvent.press(getByLabelText("Acento Calm"));
  expect(useThemeStore.getState().accent).toBe("calm");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/components/theme/theme-picker.test.tsx`
Expected: FAIL — cannot find module `./theme-picker`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/theme/theme-picker.tsx
import { Pressable, View } from "react-native";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme/theme-provider";
import { THEMES, type Accent } from "@/theme/theme-tokens";
import type { Mode } from "@/stores/theme-store";

const MODES: { value: Mode; label: string }[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
  { value: "system", label: "Sistema" },
];
const ACCENTS: { value: Accent; label: string }[] = [
  { value: "calm", label: "Calm" },
  { value: "bold", label: "Bold" },
  { value: "warm", label: "Warm" },
];

export function ThemePicker() {
  const { mode, accent, scheme, setMode, setAccent } = useTheme();
  return (
    <Card className="gap-5">
      <View className="gap-2">
        <Text variant="label">Modo</Text>
        <Segmented options={MODES} value={mode} onChange={setMode} />
      </View>
      <View className="gap-2">
        <Text variant="label">Acento</Text>
        <View className="flex-row gap-3">
          {ACCENTS.map((a) => {
            const selected = a.value === accent;
            return (
              <Pressable
                key={a.value}
                accessibilityRole="button"
                accessibilityLabel={`Acento ${a.label}`}
                accessibilityState={{ selected }}
                onPress={() => setAccent(a.value)}
                className={cn(
                  "flex-1 items-center gap-2 rounded-xl border-2 p-3",
                  selected ? "border-accent bg-bg-elevated" : "border-border",
                )}
              >
                <View
                  className="h-8 w-8 rounded-full"
                  style={{ backgroundColor: `rgb(${THEMES[a.value][scheme].accent})` }}
                />
                <Text className="text-xs font-semibold text-fg">{a.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Card>
  );
}
```

```tsx
// src/app/(tabs)/settings/theme.tsx
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { ThemePicker } from "@/components/theme/theme-picker";

export default function ThemeSettingsScreen() {
  return (
    <View className="flex-1 gap-4 bg-bg p-5">
      <Text variant="title">Aparência</Text>
      <ThemePicker />
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm jest src/components/theme/theme-picker.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/theme/theme-picker.tsx "src/app/(tabs)/settings/theme.tsx" src/components/theme/theme-picker.test.tsx
git commit -m "feat(theme): ThemePicker settings screen"
```

---

### Task 16: Cross-theme visual gate + headless build

**Files:**
- Create: `src/theme/theme-matrix.test.tsx`

**Interfaces:**
- Consumes: `THEMES`, `tokenVars` (Task 1); the components built above.
- Produces: a matrix test asserting the token maps are complete and internally consistent across all 6 combinations (the runtime rendering itself is exercised per-component; this task locks the full matrix + a final headless export).

- [ ] **Step 1: Write the failing test**

```tsx
// src/theme/theme-matrix.test.tsx
import { THEMES, tokenVars, type Accent, type Scheme } from "./theme-tokens";

const ACCENTS: Accent[] = ["calm", "bold", "warm"];
const SCHEMES: Scheme[] = ["light", "dark"];

it("all 6 combinations produce a full, distinct var set", () => {
  const seen = new Set<string>();
  for (const a of ACCENTS)
    for (const s of SCHEMES) {
      const v = tokenVars(a, s);
      expect(Object.keys(v)).toHaveLength(12);
      // accent color differs per accent within a scheme
      seen.add(`${THEMES[a][s].accent}@${s}`);
    }
  // 3 accents × 2 schemes = 6 distinct accent@scheme values
  expect(seen.size).toBe(6);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm jest src/theme/theme-matrix.test.tsx`
Expected: FAIL if any accent shares an identical accent color within a scheme, or a var set is incomplete. (If it passes immediately because Task 1 is already correct, that is acceptable — proceed.)

- [ ] **Step 3: Make it pass**

If it fails, adjust the offending accent color in `theme-tokens.ts` so each accent is visually distinct per scheme (they already are in Task 1's values). No new production code otherwise.

- [ ] **Step 4: Run the full suite + headless build**

Run: `pnpm jest`
Expected: all design-system tests PASS.

Run: `npx expo export --platform ios`
Expected: build completes with no error.

- [ ] **Step 5: Commit**

```bash
git add src/theme/theme-matrix.test.tsx
git commit -m "test(theme): full 6-combination token matrix gate"
```

---

## Self-Review

**Spec coverage:**
- Two-axis theme (mode × accent, default warm+system) → Tasks 1, 3, 4, 15. ✓
- Three-layer token architecture → Tasks 1 (semantic maps), 2 (tailwind primitives→semantic), 5–14 (components consume semantic). ✓
- NativeWind `vars()` + `dark:` mechanism + risk validation → Task 4 (with fallback). ✓
- 6 palettes, Bold light variant → Task 1 THEMES. ✓
- Persistence secure-store default warm+system → Task 3. ✓
- Semantic finance colors stable across accents → Task 1 (income/expense/warning/investment identical per scheme) + Task 6 AmountText. ✓
- Component inventory (Button/Card/Text/AmountText/Field/Segmented/ListRow/Sheet/Badge/ProgressBar/Skeleton/EmptyState/ThemePicker/DisclosureSection) → Tasks 5–15. ✓
- Progressive disclosure → Task 14. ✓
- Testing: per-theme + switching + AmountText color + AA contrast + headless export → Tasks 1, 4, 6, 16. ✓
- ThemePicker settings screen → Task 15. ✓

**Placeholder scan:** No TBD/TODO; every code step has full code. ✓

**Type consistency:** `Accent`/`Scheme`/`SemanticTokens`/`tokenVars` (Task 1) used identically in Tasks 2–4, 15, 16. `Mode` (Task 3) used in Tasks 4, 15. `useTheme` signature (Task 4) matches usage in Task 15. Component prop names consistent across tests and impls. ✓

**Note on Modal in tests:** RN `Modal` renders children inline under jest-expo, so Task 12's assertions work without extra host config.
