import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import * as RN from "react-native";
import { ApiError } from "@/api/client";
import PlanScreen from "@/app/(tabs)/settings/plan";

// onCancel confirms via a native Alert before calling cancel.mutate; auto-press
// the destructive option so cancel tests can exercise the mutation directly.
jest.spyOn(RN.Alert, "alert").mockImplementation((_title, _message, buttons) => {
  buttons?.find((b) => b.style === "destructive")?.onPress?.();
});

// plan.tsx -> @/lib/context-errors -> @/api/client -> @/lib/auth, which pulls in
// the native google-signin module. Mock it before any imports resolve it.
jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
  },
}));

const mockSubscribe = jest.fn().mockResolvedValue({ ok: true });
const mockSwitchMutate = jest.fn();
const mockCancelMutate = jest.fn();
let mockSubData: unknown = {
  plan: "free",
  status: "active",
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  interval: null,
  entitlements: { aiInsights: false, futureProjection: false, unlimitedContexts: false, maxContexts: 2 },
};

jest.mock("@/stores/household-store", () => ({
  useHouseholdStore: (sel: (s: unknown) => unknown) => sel({ activeHouseholdId: "hh-1" }),
}));
jest.mock("@/api/generated", () => ({
  useGetSubscription: () => ({ data: mockSubData, isLoading: false, refetch: jest.fn() }),
  useSwitchSubscriptionInterval: () => ({ mutate: mockSwitchMutate, isPending: false }),
  useCancelSubscription: () => ({ mutate: mockCancelMutate, isPending: false }),
}));
jest.mock("@/hooks/use-payment-sheet-checkout", () => ({
  usePaymentSheetCheckout: () => ({ subscribe: mockSubscribe, isBusy: false }),
}));

describe("PlanScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("free user can subscribe monthly", async () => {
    mockSubData = {
      plan: "free",
      status: "active",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      interval: null,
      entitlements: { aiInsights: false, futureProjection: false, unlimitedContexts: false, maxContexts: 2 },
    };
    await render(<PlanScreen />);
    fireEvent.press(screen.getByText(/Assinar/i));
    await waitFor(() => expect(mockSubscribe).toHaveBeenCalledWith("monthly"));
  });

  it("premium user sees manage actions", async () => {
    mockSubData = {
      plan: "premium",
      status: "active",
      currentPeriodEnd: "2099-01-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
      interval: "monthly",
      entitlements: { aiInsights: true, futureProjection: true, unlimitedContexts: true, maxContexts: 9999 },
    };
    await render(<PlanScreen />);
    expect(screen.getByText(/Premium/i)).toBeTruthy();
    expect(screen.getByText(/Cancelar/i)).toBeTruthy();
  });

  it("cancelAtPeriodEnd premium hides cancel button and shows access note", async () => {
    mockSubData = {
      plan: "premium",
      status: "active",
      currentPeriodEnd: "2099-01-01T00:00:00.000Z",
      cancelAtPeriodEnd: true,
      interval: "monthly",
      entitlements: { aiInsights: true, futureProjection: true, unlimitedContexts: true, maxContexts: 9999 },
    };
    await render(<PlanScreen />);
    expect(screen.getByText(/Acesso até/i)).toBeTruthy();
    expect(screen.queryByText(/Cancelar assinatura/i)).toBeNull();
  });

  it("shows the mapped error message when switching interval fails", async () => {
    mockSubData = {
      plan: "premium",
      status: "active",
      currentPeriodEnd: "2099-01-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
      interval: "monthly",
      entitlements: { aiInsights: true, futureProjection: true, unlimitedContexts: true, maxContexts: 9999 },
    };
    mockSwitchMutate.mockImplementation((_vars, opts) => opts.onError(new ApiError(402, "SUB-T0005")));
    await render(<PlanScreen />);
    fireEvent.press(screen.getByText("Anual"));
    await waitFor(() => {
      expect(screen.getByText("Falha no pagamento. Tente novamente.")).toBeTruthy();
    });
  });

  it("shows the mapped error message when canceling fails", async () => {
    mockSubData = {
      plan: "premium",
      status: "active",
      currentPeriodEnd: "2099-01-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
      interval: "monthly",
      entitlements: { aiInsights: true, futureProjection: true, unlimitedContexts: true, maxContexts: 9999 },
    };
    mockCancelMutate.mockImplementation((_vars, opts) => opts.onError(new ApiError(404, "SUB-T0004")));
    await render(<PlanScreen />);
    fireEvent.press(screen.getByText(/Cancelar assinatura/i));
    await waitFor(() => {
      expect(screen.getByText("Nenhuma assinatura ativa encontrada.")).toBeTruthy();
    });
  });
});
