import { render, screen } from "@testing-library/react-native";
import { PaywallGate } from "./paywall-gate";
import { Text } from "@/components/ui/text";

let mockPremium = false;
jest.mock("@/hooks/use-entitlements", () => ({
  useEntitlement: () => mockPremium,
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe("PaywallGate", () => {
  it("renders children when entitled", async () => {
    mockPremium = true;
    await render(<PaywallGate feature="aiInsights"><Text>SECRET</Text></PaywallGate>);
    expect(screen.getByText("SECRET")).toBeTruthy();
  });
  it("renders a locked CTA when not entitled", async () => {
    mockPremium = false;
    await render(<PaywallGate feature="aiInsights" title="IA"><Text>SECRET</Text></PaywallGate>);
    expect(screen.queryByText("SECRET")).toBeNull();
    expect(screen.getByText(/Premium/i)).toBeTruthy();
  });
});
