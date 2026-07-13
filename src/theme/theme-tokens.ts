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
      warning: "251 191 36", investment: "165 180 252", neutral: "148 163 176",
    },
  },
  warm: {
    light: {
      bg: "251 247 241", bgElevated: "255 255 255", fg: "43 38 32",
      fgSecondary: "92 82 70", border: "234 224 210", accent: "170 90 50",
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
