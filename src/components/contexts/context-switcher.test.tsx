jest.mock("@/api/generated", () => ({
  useListHouseholds: () => ({
    data: {
      households: [
        { id: "h1", name: "Minha Conta", type: "individual" },
        { id: "h2", name: "Família da Silva", type: "family" },
      ],
    },
    isLoading: false,
  }),
}));

const mockSetActiveHousehold = jest.fn();
jest.mock("@/stores/household-store", () => ({
  useHouseholdStore: (sel: (s: unknown) => unknown) =>
    sel({ activeHouseholdId: "h1", setActiveHousehold: mockSetActiveHousehold }),
}));

import { fireEvent, render } from "@testing-library/react-native";
import { ContextSwitcher } from "./context-switcher";

it("lists contexts and switches the active one on tap", async () => {
  mockSetActiveHousehold.mockClear();
  const onClose = jest.fn();
  const { getByText } = await render(
    <ContextSwitcher visible onClose={onClose} onCreate={() => {}} onRedeem={() => {}} />,
  );
  expect(getByText("Pessoal")).toBeTruthy();
  fireEvent.press(getByText("Família"));
  expect(mockSetActiveHousehold).toHaveBeenCalledWith("h2");
  expect(onClose).toHaveBeenCalled();
});

it("exposes create and redeem actions", async () => {
  const onCreate = jest.fn();
  const onRedeem = jest.fn();
  const { getByText } = await render(
    <ContextSwitcher visible onClose={() => {}} onCreate={onCreate} onRedeem={onRedeem} />,
  );
  fireEvent.press(getByText("Criar contexto"));
  fireEvent.press(getByText("Entrar com código"));
  expect(onCreate).toHaveBeenCalled();
  expect(onRedeem).toHaveBeenCalled();
});
