import { renderHook } from "@testing-library/react-native";
import { useEntitlements } from "./use-entitlements";

const mockData: { data: unknown; isLoading: boolean } = { data: undefined, isLoading: false };
jest.mock("@/api/generated", () => ({ useGetSubscription: () => mockData }));
jest.mock("@/stores/household-store", () => ({ useHouseholdStore: (sel: (s: unknown) => unknown) => sel({ activeHouseholdId: "hh-1" }) }));

describe("useEntitlements", () => {
  it("defaults to free when no data", async () => {
    mockData.data = undefined;
    const { result } = await renderHook(() => useEntitlements());
    expect(result.current.isPremium).toBe(false);
    expect(result.current.entitlements.aiInsights).toBe(false);
  });
  it("reports premium from subscription data", async () => {
    mockData.data = { plan: "premium", entitlements: { aiInsights: true, futureProjection: true, unlimitedContexts: true, maxContexts: 9999 } };
    const { result } = await renderHook(() => useEntitlements());
    expect(result.current.isPremium).toBe(true);
    expect(result.current.entitlements.aiInsights).toBe(true);
  });
});
