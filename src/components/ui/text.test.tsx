import { render } from "@testing-library/react-native";
import { Text } from "./text";

it("applies the display scale", async () => {
  const { getByText } = await render(<Text variant="display">Hi</Text>);
  expect(getByText("Hi").props.className).toContain("text-3xl");
});

it("uses secondary color for captions", async () => {
  const { getByText } = await render(<Text variant="caption">note</Text>);
  expect(getByText("note").props.className).toContain("text-fg-secondary");
});

it("defaults to body on fg", async () => {
  const { getByText } = await render(<Text>hello</Text>);
  expect(getByText("hello").props.className).toContain("text-fg");
});
