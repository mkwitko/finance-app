const mockMutate = jest.fn();
let mockQuery: { data?: { insights: unknown[] }; isLoading: boolean; refetch: () => void };
jest.mock("@/api/generated", () => ({
  useGetInsights: () => mockQuery,
  useRefreshInsights: () => ({ mutate: mockMutate, isPending: false }),
}));
jest.mock("@/stores/household-store", () => ({
  useHouseholdStore: (sel: (s: unknown) => unknown) => sel({ activeHouseholdId: "h1" }),
}));

import { fireEvent, render } from "@testing-library/react-native";
import { InsightsFeed } from "./insights-feed";

beforeEach(() => { mockMutate.mockClear(); });

it("shows an empty state when there are no insights", async () => {
  mockQuery = { data: { insights: [] }, isLoading: false, refetch: jest.fn() };
  const { getByText } = await render(<InsightsFeed />);
  expect(getByText(/Ainda não há insights/i)).toBeTruthy();
});

it("renders insight cards", async () => {
  mockQuery = {
    data: { insights: [{ id: "i1", kind: "summary", severity: "positive", title: "Resumo", body: "corpo", recommendation: null }] },
    isLoading: false,
    refetch: jest.fn(),
  };
  const { getByText } = await render(<InsightsFeed />);
  expect(getByText("Resumo")).toBeTruthy();
});

it("refresh button triggers regeneration for the active household", async () => {
  const refetch = jest.fn();
  mockQuery = { data: { insights: [] }, isLoading: false, refetch };
  const { getByText } = await render(<InsightsFeed />);
  fireEvent.press(getByText("Atualizar"));
  expect(mockMutate).toHaveBeenCalledWith({ id: "h1" }, expect.any(Object));
});
