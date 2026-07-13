import { render } from "@testing-library/react-native";
import { Button } from "./button";

it("primary uses accent background", async () => {
  const { getByRole } = await render(<Button label="Save" />);
  expect(getByRole("button").props.className).toContain("bg-accent");
});

it("danger uses expense background", async () => {
  const { getByRole } = await render(<Button label="Delete" variant="danger" />);
  expect(getByRole("button").props.className).toContain("bg-expense");
});

it("disables when loading", async () => {
  const { getByRole } = await render(<Button label="Save" loading />);
  expect(getByRole("button").props.accessibilityState.disabled).toBe(true);
});
