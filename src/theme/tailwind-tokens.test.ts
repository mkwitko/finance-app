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
