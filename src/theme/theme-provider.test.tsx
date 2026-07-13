jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
const mockSetColorScheme = jest.fn();
jest.mock("nativewind", () => ({
  useColorScheme: () => ({ colorScheme: "light", setColorScheme: mockSetColorScheme }),
  vars: (obj: Record<string, string>) => obj, // identity for assertion
}));

import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import { ThemeProvider, useTheme } from "./theme-provider";
import { useThemeStore } from "@/stores/theme-store";

function Probe() {
  const { accent, scheme } = useTheme();
  return <Text>{`${accent}:${scheme}`}</Text>;
}

it("resolves accent + scheme and syncs color scheme", async () => {
  useThemeStore.setState({ mode: "system", accent: "warm" });
  const { getByText } = await render(
    <ThemeProvider><Probe /></ThemeProvider>,
  );
  expect(getByText("warm:light")).toBeTruthy();
  expect(mockSetColorScheme).toHaveBeenCalledWith("system");
});

it("forces scheme when mode is not system", async () => {
  useThemeStore.setState({ mode: "dark", accent: "calm" });
  const { getByText } = await render(
    <ThemeProvider><Probe /></ThemeProvider>,
  );
  expect(getByText("calm:dark")).toBeTruthy();
});
