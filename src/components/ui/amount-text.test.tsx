import { render } from "@testing-library/react-native";
import { AmountText } from "./amount-text";

it("formats cents as BRL", async () => {
  const { getByText } = await render(<AmountText cents={-18400} />);
  // formatCents(-18400) => "-R$ 184,00" (pt-BR)
  expect(getByText(/184,00/)).toBeTruthy();
});

it("colors positive as income, negative as expense", async () => {
  const { getByText } = await render(<AmountText cents={5000} />);
  expect(getByText(/50,00/).props.className).toContain("text-income");
  const { getByText: g2 } = await render(<AmountText cents={-5000} />);
  expect(g2(/50,00/).props.className).toContain("text-expense");
});

it("uses fg when colorize is false", async () => {
  const { getByText } = await render(<AmountText cents={5000} colorize={false} />);
  expect(getByText(/50,00/).props.className).toContain("text-fg");
});
