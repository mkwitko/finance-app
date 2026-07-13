import { fireEvent, render } from "@testing-library/react-native";
import { Badge } from "./badge";
import { ProgressBar } from "./progress-bar";
import { Skeleton } from "./skeleton";
import { EmptyState } from "./empty-state";

it("Badge tones map to token text color", async () => {
  const { getByText } = await render(<Badge label="Meta" tone="income" />);
  expect(getByText("Meta").props.className).toContain("text-income");
});

it("ProgressBar clamps and reports accessibility value", async () => {
  const { getByRole } = await render(<ProgressBar value={1.5} />);
  expect(getByRole("progressbar").props.accessibilityValue).toEqual({ now: 100, min: 0, max: 100 });
});

it("Skeleton renders a placeholder block", async () => {
  const { getByTestId } = await render(<Skeleton testID="sk" />);
  expect(getByTestId("sk").props.className).toContain("bg-border");
});

it("EmptyState fires its action", async () => {
  const onAction = jest.fn();
  const { getByText } = await render(
    <EmptyState title="Sem dados" actionLabel="Importar" onAction={onAction} />,
  );
  fireEvent.press(getByText("Importar"));
  expect(onAction).toHaveBeenCalled();
});
