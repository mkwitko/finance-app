import { render, screen } from "@testing-library/react-native";
import InsightsScreen from "@/app/(tabs)/insights";

let mockEntitled = false;
let mockLoading = false;
jest.mock("@/hooks/use-entitlements", () => ({
  useEntitlements: () => ({
    entitlements: { aiInsights: mockEntitled, futureProjection: false, unlimitedContexts: false, maxContexts: 2 },
    isPremium: mockEntitled,
    isLoading: mockLoading,
    plan: mockEntitled ? "premium" : "free",
  }),
}));
jest.mock("@/components/insights/insights-feed", () => {
  const { Text } = require("@/components/ui/text");
  return { InsightsFeed: () => <Text>FEED</Text> };
});
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe("InsightsScreen", () => {
  beforeEach(() => {
    mockEntitled = false;
    mockLoading = false;
  });

  it("shows the feed when entitled", async () => {
    mockEntitled = true;
    await render(<InsightsScreen />);
    expect(screen.getByText("FEED")).toBeTruthy();
  });

  it("shows the paywall CTA and hides the feed when not entitled", async () => {
    mockEntitled = false;
    await render(<InsightsScreen />);
    expect(screen.queryByText("FEED")).toBeNull();
    expect(screen.getByText(/Premium/i)).toBeTruthy();
  });
});
