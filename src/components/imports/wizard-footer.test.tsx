import { fireEvent, render } from "@testing-library/react-native";
import { WizardFooter } from "./wizard-footer";

it("fires primary + back", async () => {
  const onPrimary = jest.fn();
  const onBack = jest.fn();
  const { getByText } = await render(
    <WizardFooter primaryLabel="Continuar" onPrimary={onPrimary} onBack={onBack} />,
  );
  fireEvent.press(getByText("Continuar"));
  fireEvent.press(getByText("‹ Voltar"));
  expect(onPrimary).toHaveBeenCalled();
  expect(onBack).toHaveBeenCalled();
});

it("omits back when no onBack", async () => {
  const { queryByText } = await render(<WizardFooter primaryLabel="Ir" onPrimary={() => {}} />);
  expect(queryByText("‹ Voltar")).toBeNull();
});
