import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { DisclosureSection } from "./disclosure-section";

it("hides body until expanded", async () => {
  const { queryByText, getByText } = await render(
    <DisclosureSection title="Detalhes avançados"><Text>oculto</Text></DisclosureSection>,
  );
  expect(queryByText("oculto")).toBeNull();
  fireEvent.press(getByText("Detalhes avançados"));
  await waitFor(() => {
    expect(getByText("oculto")).toBeTruthy();
  });
});
