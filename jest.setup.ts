// Silence the native animated-helper warning under jest-expo and give a
// default expo-secure-store mock so stores don't hit native on import.
import "@testing-library/react-native";

// @stripe/stripe-react-native is a native module; it cannot load under jest.
jest.mock("@stripe/stripe-react-native", () => {
  const React = require("react");
  return {
    StripeProvider: ({ children }: { children: React.ReactNode }) => children,
    initStripe: jest.fn().mockResolvedValue(undefined),
    useStripe: () => ({
      initPaymentSheet: jest.fn().mockResolvedValue({ error: undefined }),
      presentPaymentSheet: jest.fn().mockResolvedValue({ error: undefined }),
    }),
  };
});
