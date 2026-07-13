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

describe("money-semantic colors", () => {
  it("are identical across accents within each scheme", () => {
    const MONEY = ["income", "expense", "warning", "investment"] as const;
    for (const s of SCHEMES)
      for (const k of MONEY) {
        const values = ACCENTS.map((a) => THEMES[a][s][k]);
        expect(new Set(values).size).toBe(1);
      }
  });
});
