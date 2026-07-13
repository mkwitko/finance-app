import { fireEvent, render } from "@testing-library/react-native";
import { Segmented } from "./segmented";

const OPTS = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
  { value: "system", label: "Sistema" },
];

it("marks selected segment with accent", async () => {
  const { getByText } = await render(
    <Segmented options={OPTS} value="system" onChange={() => {}} />,
  );
  expect(getByText("Sistema").props.className).toContain("text-accent");
});

it("calls onChange with the tapped value", async () => {
  const onChange = jest.fn();
  const { getByText } = await render(
    <Segmented options={OPTS} value="system" onChange={onChange} />,
  );
  fireEvent.press(getByText("Claro"));
  expect(onChange).toHaveBeenCalledWith("light");
});
