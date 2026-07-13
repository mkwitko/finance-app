import { render } from "@testing-library/react-native";
import { Field } from "./field";

it("shows label and hint", async () => {
  const { getByText } = await render(
    <Field label="Nome" value="" onChangeText={() => {}} hint="Como te chamar" />,
  );
  expect(getByText("Nome")).toBeTruthy();
  expect(getByText("Como te chamar")).toBeTruthy();
});

it("shows error in place of hint", async () => {
  const { getByText, queryByText } = await render(
    <Field label="Email" value="x" onChangeText={() => {}} hint="opcional" error="Inválido" />,
  );
  expect(getByText("Inválido").props.className).toContain("text-expense");
  expect(queryByText("opcional")).toBeNull();
});
