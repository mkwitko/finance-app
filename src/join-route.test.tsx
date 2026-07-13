const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ code: "AbCdEfGhJk" }),
  router: { replace: (...a: unknown[]) => mockReplace(...a) },
}));
jest.mock("@/components/contexts/redeem-code-form", () => ({
  RedeemCodeForm: ({ initialCode, onJoined }: { initialCode: string; onJoined: (h: { id: string }) => void }) => {
    const { Text, Pressable } = require("react-native");
    return (
      <Pressable onPress={() => onJoined({ id: "h1" })}>
        <Text>{`join:${initialCode}`}</Text>
      </Pressable>
    );
  },
}));

import { fireEvent, render } from "@testing-library/react-native";
import JoinScreen from "@/app/join/[code]";

it("prefills the code and navigates home after joining", async () => {
  const { getByText } = await render(<JoinScreen />);
  expect(getByText("join:AbCdEfGhJk")).toBeTruthy();
  fireEvent.press(getByText("join:AbCdEfGhJk"));
  expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
});
