jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {},
}));

const mockMutate = jest.fn();
const mockSetActiveHousehold = jest.fn();
jest.mock("@/api/generated", () => ({ useRedeemInvitation: () => ({ mutate: mockMutate, isPending: false }) }));
jest.mock("@/stores/household-store", () => ({
  useHouseholdStore: (sel: (s: unknown) => unknown) => sel({ setActiveHousehold: mockSetActiveHousehold }),
}));

import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { RedeemCodeForm } from "./redeem-code-form";

it("redeems the code, switches active context, and reports joined", async () => {
  mockMutate.mockClear();
  mockMutate.mockImplementation((_vars, opts) => opts.onSuccess({ id: "h9", name: "Casa" }));
  const onJoined = jest.fn();
  const { getByText, getByTestId } = await render(
    <RedeemCodeForm onJoined={onJoined} />,
  );

  const codeInput = getByTestId("code-input");
  fireEvent.changeText(codeInput, "AbCdEfGhJk");

  await waitFor(() => {
    expect(codeInput.props.value).toBe("AbCdEfGhJk");
  });

  fireEvent.press(getByText("Entrar"));

  expect(mockMutate).toHaveBeenCalledWith({ code: "AbCdEfGhJk" }, expect.any(Object));
  await waitFor(() => {
    expect(mockSetActiveHousehold).toHaveBeenCalledWith("h9");
    expect(onJoined).toHaveBeenCalledWith({ id: "h9", name: "Casa" });
  });
});
