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
