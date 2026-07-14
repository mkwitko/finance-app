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

it("flips hasHydrated to true once the persisted selection has been read", async () => {
  await new Promise((r) => setTimeout(r, 0));
  expect(useThemeStore.getState().hasHydrated).toBe(true);
});
