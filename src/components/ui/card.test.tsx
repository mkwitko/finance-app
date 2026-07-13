import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import { Card } from "./card";

it("renders an elevated surface with token bg", async () => {
  const { getByTestId } = await render(
    <Card testID="c">
      <Text>x</Text>
    </Card>,
  );
  expect(getByTestId("c").props.className).toContain("bg-bg-elevated");
});
