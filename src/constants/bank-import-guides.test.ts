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
