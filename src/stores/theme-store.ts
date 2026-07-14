import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Accent } from "@/theme/theme-tokens";

export type Mode = "light" | "dark" | "system";

type ThemeState = {
  mode: Mode;
  accent: Accent;
  // False until the persisted selection has been read from secure-store (or
  // confirmed absent). Consumers (see ThemeProvider) should hold render behind
  // the splash screen until this flips true, so the app never paints with the
  // default theme and then flashes to the user's real saved preference.
  hasHydrated: boolean;
  setMode: (m: Mode) => void;
  setAccent: (a: Accent) => void;
  setHasHydrated: (v: boolean) => void;
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
      hasHydrated: false,
      setMode: (mode) => set({ mode }),
      setAccent: (accent) => set({ accent }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: "theme.selection",
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({ mode: state.mode, accent: state.accent }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);
