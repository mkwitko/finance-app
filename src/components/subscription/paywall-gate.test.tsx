import { render, screen } from "@testing-library/react-native";
import { PaywallGate } from "./paywall-gate";
import { Text } from "@/components/ui/text";

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
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe("PaywallGate", () => {
  beforeEach(() => {
    mockEntitled = false;
    mockLoading = false;
  });

  it("renders children when entitled", async () => {
    mockEntitled = true;
    await render(<PaywallGate feature="aiInsights"><Text>SECRET</Text></PaywallGate>);
    expect(screen.getByText("SECRET")).toBeTruthy();
  });
  it("renders a locked CTA when not entitled", async () => {
    mockEntitled = false;
    await render(<PaywallGate feature="aiInsights" title="IA"><Text>SECRET</Text></PaywallGate>);
    expect(screen.queryByText("SECRET")).toBeNull();
    expect(screen.getByText(/Premium/i)).toBeTruthy();
  });
  it("renders nothing while loading, even for an entitled user", async () => {
    mockEntitled = true;
    mockLoading = true;
    await render(<PaywallGate feature="aiInsights" title="IA"><Text>SECRET</Text></PaywallGate>);
    expect(screen.queryByText("SECRET")).toBeNull();
    expect(screen.queryByText(/Premium/i)).toBeNull();
  });
});
