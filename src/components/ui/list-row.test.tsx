import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";
import { ListRow } from "./list-row";

it("renders title and subtitle", async () => {
  const { getByText } = await render(<ListRow title="Mercado" subtitle="Hoje" />);
  expect(getByText("Mercado")).toBeTruthy();
  expect(getByText("Hoje")).toBeTruthy();
});

it("fires onPress", async () => {
  const onPress = jest.fn();
  const { getByText } = await render(
    <ListRow title="Café" trailing={<Text>−12</Text>} onPress={onPress} />,
  );
  fireEvent.press(getByText("Café"));
  expect(onPress).toHaveBeenCalled();
});
