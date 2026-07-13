# Design System — Design Spec

**Date:** 2026-07-13
**Project:** finance-app (Expo SDK 57 / RN 0.86 / React 19, NativeWind v4)
**Status:** Approved for planning

## Context

finance-app is the mobile client of a personal-finance app aimed at everyday
people organizing money and reaching future goals. The vision spans six
subsystems (design system, multi-account contexts, future projection, investing
education, AI copilot, subscription). **This spec covers only the design
system** — the visual foundation every other subsystem renders on. It is built
first because it is cheap to get right early and expensive to retrofit.

The app today uses a lightly-customized Expo starter theme: pure black/white
backgrounds, a brand teal `#0E7C7B`, a thin token set (`src/constants/theme.ts`),
and a few UI components (`button`, `card`, `text`, `collapsible`, `themed-view`,
`themed-text`). Display font is Spline Sans (web `--font-display`). This spec
replaces that ad-hoc theme with a real, cohesive, multi-theme design system.

## Goals

- Modern, elegant, clean visual identity — light and dark.
- A **theme selector** with two independent axes (below), default **Warm + System**.
- Simple by default, powerful on demand, via **progressive disclosure** (no global
  beginner/advanced mode).
- A component library that all future subsystems consume, using semantic tokens
  only — never raw colors.

## Non-Goals

- No screens/features of other subsystems (accounts UI, copilot chat, paywall, etc.).
- No global "beginner vs advanced" mode toggle.
- No new fonts beyond the existing Spline Sans display + system stack.

## Theme Model — Two Independent Axes

1. **Mode**: `light` | `dark` | `system` (auto, follows OS). Default `system`.
2. **Accent (personality)**: `calm` | `bold` | `warm`. Default `warm`.

3 accents × 2 rendered modes = **6 palettes**.

| Accent | Feel | Light seed | Dark seed | Accent color |
|--------|------|-----------|-----------|--------------|
| Calm | Sereno, confiança, muito respiro | sand-neutral off-white | near-black | teal `#0E7C7B` (evolves current brand) |
| Bold | Dark-first, alto contraste, ousado | light variant provided | `#111318` base | lime→mint `#B6FF3C`→`#5CE1A0` |
| Warm | Acolhedor, humano, menos "banco" | cream `#FBF7F1` | warm-dark | amber-coral `#E08A4E` |

Bold is dark-first but ships a light variant so every accent works in both modes.

## Architecture — Three Token Layers

```
Primitives            Semantic tokens              Components
(raw palette values)  (role-based, theme-driven)   (consume semantic only)
teal-500  #0E7C7B  →  color-accent              →  <Button variant="primary">
amber-500 #E08A4E     color-accent-fg               <Card>
sand-50   #FBF7F1     color-bg / bg-elevated        <AmountText>
red-500               color-text / -secondary
green-500             color-income / -expense
...                   color-danger / -warning / -investment / -neutral
                      color-border
```

**Rule:** components reference only semantic tokens. Switching accent or mode
remaps the semantic layer; component code never changes.

### NativeWind v4 mechanism

- Semantic tokens are defined as CSS variables consumed in `tailwind.config.js`
  via `hsl(var(--color-…))` (shadcn-style).
- **Mode axis** driven by NativeWind's `dark:` variant.
- **Accent axis** driven by NativeWind `vars()` applied to a root `<View>` that
  wraps the app; changing accent swaps the variable set at runtime, on web and
  native.
- **RISK / must-validate first in the plan:** confirm NativeWind v4 on Expo SDK
  57 can drive *both* a runtime accent swap (`vars()` on a root view) *and* the
  `dark:` mode variant simultaneously on native. If a limitation surfaces,
  fallback is a small `ThemeProvider` React context exposing the resolved token
  object, with a thin `useToken()`/styled wrapper — decided during planning, not
  now. This validation is the first task of the implementation plan.

### Persistence

- `{ mode, accent }` stored in `expo-secure-store` (or async-storage per existing
  pattern), read on boot, applied before first paint to avoid flash.
- Default when unset: `{ mode: 'system', accent: 'warm' }`.
- A zustand store (matching the existing `household-store` pattern) holds the
  active theme selection and exposes setters.

## Semantic Finance Colors (stable across accents)

Money semantics do **not** change with accent — only tone-tuned per palette to
keep WCAG AA contrast:

- `income` — green (money in, always green in every theme)
- `expense` — soft red (money out)
- `warning` — amber
- `investment` — purple/blue
- `neutral` — muted gray for zero/pending

## Component Inventory (v1)

Reuse/expand existing (`button`, `card`, `text`, `collapsible`, `themed-*`):

- `Button` — variants `primary` | `secondary` | `ghost` | `danger`, sizes sm/md/lg
- `Card` — surface with elevation token
- `Text` — typographic scale (display/title/body/caption/label) on Spline Sans
- `AmountText` — formats BRL, colors by `income`/`expense`/`neutral`
- `Input` / `Field` — label, error, hint states
- `Segmented` — the mode/accent control used in ThemePicker
- `ListRow` — leading icon, title/subtitle, trailing value (transactions etc.)
- `Sheet` / `Modal` — bottom sheet + centered modal
- `Badge` — status/tag pill
- `ProgressBar` — goal progress
- `Skeleton` — loading placeholder
- `EmptyState` — icon + message + optional action
- `ThemePicker` — the settings screen: Mode segmented + Accent swatches
- `DisclosureSection` — progressive-disclosure primitive (see below)

## Progressive Disclosure

- No global level toggle. Every screen shows essentials by default; advanced
  detail lives behind a `DisclosureSection` ("ver detalhes" / expand), built on
  the existing `collapsible`.
- Convention documented for subsystem authors: each screen explicitly labels
  what is "essential" (always visible) vs "advanced" (disclosed).

## Testing

- **Jest + RNTL**: snapshot each component across the 6 theme combinations;
  test theme switching updates rendered tokens; `AmountText` applies correct
  income/expense color; assert WCAG AA contrast on text/background token pairs.
- **Verify**: `npx expo export --platform ios` builds headlessly.

## Files (anticipated)

- `src/constants/theme.ts` — expanded: primitives + per-accent/mode token maps
- `tailwind.config.js` — semantic tokens as `hsl(var(--…))`
- `src/global.css` — CSS variable definitions per theme class (web)
- `src/theme/` — `ThemeProvider`, `useTheme`/`useToken`, theme store
- `src/components/ui/*` — new/expanded components above
- `app/(settings)/theme.tsx` (or equivalent route) — ThemePicker screen

## Open Questions (resolve in plan, not blocking)

- Exact NativeWind `vars()` + `dark:` interplay on native (first plan task).
- Whether to persist via secure-store vs async-storage (follow existing app choice).
