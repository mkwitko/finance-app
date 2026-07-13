import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// The active household (Uber-style profile switch). Its uuid is sent as the
// `x-household-id` header on every household-scoped API call (see api/client.ts).
type HouseholdState = {
  activeHouseholdId: string | null;
  setActiveHousehold: (id: string | null) => void;
};

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const useHouseholdStore = create<HouseholdState>()(
  persist(
    (set) => ({
      activeHouseholdId: null,
      setActiveHousehold: (id) => set({ activeHouseholdId: id }),
    }),
    { name: "household.active", storage: createJSONStorage(() => secureStorage) },
  ),
);
