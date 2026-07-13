jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {},
}));

const mockMutate = jest.fn();
jest.mock("@/api/generated", () => ({
  useCreateHousehold: () => ({ mutate: mockMutate, isPending: false }),
}));

const mockSetActiveHousehold = jest.fn();
jest.mock("@/stores/household-store", () => ({
  useHouseholdStore: (sel: (s: unknown) => unknown) => sel({ setActiveHousehold: mockSetActiveHousehold }),
}));

import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { CreateContextForm } from "./create-context-form";

it("submits name + selected type, and switches to the new context on success", async () => {
  mockMutate.mockClear();
  mockSetActiveHousehold.mockClear();
  mockMutate.mockImplementation((_vars, opts) => opts.onSuccess({ id: "h5" }));
  const { getByText, getByTestId } = await render(
    <CreateContextForm onCreated={() => {}} />,
  );

  const nameInput = getByTestId("name-input");

  fireEvent.changeText(nameInput, "Nossa casa");

  await waitFor(() => {
    expect(nameInput.props.value).toBe("Nossa casa");
  });

  fireEvent.press(getByText("Casal"));

  await waitFor(() => {
    const criarButton = getByText("Criar");
    expect(criarButton.parent.props.accessibilityState.disabled).toBe(false);
  });

  fireEvent.press(getByText("Criar"));

  expect(mockMutate).toHaveBeenCalledWith(
    { data: { name: "Nossa casa", type: "shared" } },
    expect.any(Object),
  );

  await waitFor(() => {
    expect(mockSetActiveHousehold).toHaveBeenCalledWith("h5");
  });
});
