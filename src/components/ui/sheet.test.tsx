import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { Sheet } from "./sheet";

it("renders children when visible", async () => {
  const { getByText } = await render(
    <Sheet visible onClose={() => {}} title="Tema"><Text>corpo</Text></Sheet>,
  );
  expect(getByText("Tema")).toBeTruthy();
  expect(getByText("corpo")).toBeTruthy();
});

it("calls onClose when backdrop pressed", async () => {
  const onClose = jest.fn();
  const { getByTestId } = await render(
    <Sheet visible onClose={onClose}><Text>x</Text></Sheet>,
  );
  fireEvent.press(getByTestId("sheet-backdrop"));
  expect(onClose).toHaveBeenCalled();
});
