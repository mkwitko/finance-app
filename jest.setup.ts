// Silence the native animated-helper warning under jest-expo and give a
// default expo-secure-store mock so stores don't hit native on import.
import "@testing-library/react-native";

// Initialize the real i18next instance for every test file. Component tests
// render with `useTranslation()` + `t("ns:key")` and assert on the resulting
// pt-BR text (not the key), so i18n must be ready before any render() call.
import "@/lib/i18n";

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
