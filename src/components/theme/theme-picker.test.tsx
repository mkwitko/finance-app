jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
jest.mock("nativewind", () => ({
  useColorScheme: () => ({ colorScheme: "light", setColorScheme: jest.fn() }),
  vars: (o: Record<string, string>) => o,
}));

import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { ThemePicker } from "./theme-picker";
import { useThemeStore } from "@/stores/theme-store";

it("changes mode via segmented", async () => {
  useThemeStore.setState({ mode: "system", accent: "warm" });
  const { getByText } = await render(<ThemePicker />);
  fireEvent.press(getByText("Escuro"));
  await waitFor(() => expect(useThemeStore.getState().mode).toBe("dark"));
});

it("changes accent via swatch", async () => {
  useThemeStore.setState({ mode: "system", accent: "warm" });
  const { getByLabelText } = await render(<ThemePicker />);
  fireEvent.press(getByLabelText("Acento Calm"));
  await waitFor(() => expect(useThemeStore.getState().accent).toBe("calm"));
});
