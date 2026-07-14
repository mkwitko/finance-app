import { renderHook, act } from "@testing-library/react-native";
import { usePaymentSheetCheckout } from "./use-payment-sheet-checkout";

// use-payment-sheet-checkout.ts -> @/lib/context-errors -> @/api/client -> @/lib/auth,
// which pulls in the native google-signin module. Mock it before any imports resolve it.
jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
  },
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockCheckoutMutate = jest.fn();
const mockInitPaymentSheet = jest.fn().mockResolvedValue({ error: undefined });
const mockPresentPaymentSheet = jest.fn().mockResolvedValue({ error: undefined });
const mockInvalidateQueries = jest.fn();
const mockInitStripe = jest.fn().mockResolvedValue(undefined);

jest.mock("@/api/generated", () => ({ useCheckoutSubscription: () => ({ mutateAsync: mockCheckoutMutate }) }));
jest.mock("@stripe/stripe-react-native", () => ({
  initStripe: (...args: unknown[]) => mockInitStripe(...args),
  useStripe: () => ({ initPaymentSheet: mockInitPaymentSheet, presentPaymentSheet: mockPresentPaymentSheet }),
}));
jest.mock("@/stores/household-store", () => ({ useHouseholdStore: (sel: (s: unknown) => unknown) => sel({ activeHouseholdId: "hh-1" }) }));
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }) }));

describe("usePaymentSheetCheckout", () => {
  beforeEach(() => jest.clearAllMocks());

  it("runs checkout, inits + presents the sheet, invalidates on success", async () => {
    mockCheckoutMutate.mockResolvedValue({ paymentIntentClientSecret: "pi_x", ephemeralKeySecret: "ek_x", customerId: "cus_x", publishableKey: "pk_x" });
    const { result } = await renderHook(() => usePaymentSheetCheckout());
    let out: { ok: boolean } | undefined;
    await act(async () => {
      out = await result.current.subscribe("monthly");
    });
    expect(mockCheckoutMutate).toHaveBeenCalledWith({ id: "hh-1", data: { interval: "monthly" } });
    expect(mockInitStripe).toHaveBeenCalledWith(expect.objectContaining({ publishableKey: "pk_x" }));
    expect(mockInitPaymentSheet).toHaveBeenCalled();
    expect(mockPresentPaymentSheet).toHaveBeenCalled();
    expect(mockInvalidateQueries).toHaveBeenCalled();
    expect(out?.ok).toBe(true);
  });

  it("returns canceled when the user dismisses the sheet", async () => {
    mockCheckoutMutate.mockResolvedValue({ paymentIntentClientSecret: "pi_x", ephemeralKeySecret: "ek_x", customerId: "cus_x", publishableKey: "pk_x" });
    mockPresentPaymentSheet.mockResolvedValueOnce({ error: { code: "Canceled", message: "canceled" } });
    const { result } = await renderHook(() => usePaymentSheetCheckout());
    let out: { ok: boolean; canceled?: boolean } | undefined;
    await act(async () => {
      out = await result.current.subscribe("monthly");
    });
    expect(out?.ok).toBe(false);
    expect(out?.canceled).toBe(true);
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });
});
