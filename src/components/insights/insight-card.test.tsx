import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { InsightCard } from "./insight-card";

const base = { kind: "summary", severity: "positive" as const, title: "Bom mês", body: "Você economizou.", recommendation: null };

it("renders title, body, and a severity badge", async () => {
  const { getByText } = await render(<InsightCard insight={base} />);
  expect(getByText("Bom mês")).toBeTruthy();
  expect(getByText("Você economizou.")).toBeTruthy();
});

it("hides the recommendation until disclosed, then shows it", async () => {
  const { queryByText, getByText } = await render(
    <InsightCard insight={{ ...base, kind: "advice", severity: "info", recommendation: "Defina um limite." }} />,
  );
  expect(queryByText("Defina um limite.")).toBeNull();
  fireEvent.press(getByText("Ver recomendação"));
  await waitFor(() => {
    expect(getByText("Defina um limite.")).toBeTruthy();
  });
});

it("shows no disclosure when there is no recommendation", async () => {
  const { queryByText } = await render(<InsightCard insight={base} />);
  expect(queryByText("Ver recomendação")).toBeNull();
});
