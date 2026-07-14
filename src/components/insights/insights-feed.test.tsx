const mockMutate = jest.fn();
let mockQuery: {
  data?: { insights: unknown[] };
  isLoading: boolean;
  isError?: boolean;
  refetch: () => void;
};
let mockActiveHouseholdId: string | null = "h1";
jest.mock("@/api/generated", () => ({
  useGetInsights: () => mockQuery,
  useRefreshInsights: () => ({ mutate: mockMutate, isPending: false }),
}));
jest.mock("@/stores/household-store", () => ({
  useHouseholdStore: (sel: (s: unknown) => unknown) => sel({ activeHouseholdId: mockActiveHouseholdId }),
}));

import { fireEvent, render } from "@testing-library/react-native";
import { InsightsFeed } from "./insights-feed";

beforeEach(() => {
  mockMutate.mockClear();
  mockActiveHouseholdId = "h1";
});

it("shows an empty state when there are no insights", async () => {
  mockQuery = { data: { insights: [] }, isLoading: false, refetch: jest.fn() };
  const { getByText } = await render(<InsightsFeed />);
  expect(getByText(/Ainda não há insights/i)).toBeTruthy();
});

it("shows a no-active-household empty state when there is no household", async () => {
  mockActiveHouseholdId = null;
  mockQuery = { data: { insights: [] }, isLoading: false, refetch: jest.fn() };
  const { getByText } = await render(<InsightsFeed />);
  expect(getByText(/Nenhum contexto ativo/i)).toBeTruthy();
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

it("shows an error state with a retry action when the query fails", async () => {
  const refetch = jest.fn();
  mockQuery = { data: undefined, isLoading: false, isError: true, refetch };
  const { getByText } = await render(<InsightsFeed />);
  expect(getByText(/Não foi possível carregar os insights/i)).toBeTruthy();
  fireEvent.press(getByText("Tentar novamente"));
  expect(refetch).toHaveBeenCalled();
});

it("supports pull-to-refresh from the empty state", async () => {
  mockQuery = { data: { insights: [] }, isLoading: false, refetch: jest.fn() };
  const { getByTestId } = await render(<InsightsFeed />);
  getByTestId("insights-scroll").props.refreshControl.props.onRefresh();
  expect(mockMutate).toHaveBeenCalledWith({ id: "h1" }, expect.any(Object));
});

it("supports pull-to-refresh from the error state", async () => {
  mockQuery = { data: undefined, isLoading: false, isError: true, refetch: jest.fn() };
  const { getByTestId } = await render(<InsightsFeed />);
  getByTestId("insights-scroll").props.refreshControl.props.onRefresh();
  expect(mockMutate).toHaveBeenCalledWith({ id: "h1" }, expect.any(Object));
});
