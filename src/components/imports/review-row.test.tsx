import { fireEvent, render, cleanup } from "@testing-library/react-native";
import { act } from "react";
import { ReviewRow } from "./review-row";

afterEach(cleanup);

it("renders description, category, signed amount; toggles + edits", async () => {
  const row = { description: "iFood", amountCents: 4590, direction: "out" as const, suggestedCategory: "Alimentação", duplicate: false };
  const onToggle = jest.fn();
  const onEditCategory = jest.fn();
  const { getByText, getByRole } = await render(
    <ReviewRow row={row} included onToggle={onToggle} onEditCategory={onEditCategory} />,
  );
  expect(getByText("iFood")).toBeTruthy();
  expect(getByText(/45,90/)).toBeTruthy();
  await act(() => fireEvent.press(getByRole("checkbox")));
  await act(() => fireEvent.press(getByText("Alimentação")));
  expect(onToggle).toHaveBeenCalled();
  expect(onEditCategory).toHaveBeenCalled();
});

it("marks duplicates", async () => {
  const row = { description: "iFood", amountCents: 4590, direction: "out" as const, suggestedCategory: "Alimentação", duplicate: false };
  const { getByText } = await render(
    <ReviewRow row={{ ...row, duplicate: true }} included={false} onToggle={() => {}} onEditCategory={() => {}} />,
  );
  expect(getByText("iFood")).toBeTruthy();
  expect(getByText(/duplicada/i)).toBeTruthy();
});
