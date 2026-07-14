import { initStripe, useStripe } from "@stripe/stripe-react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useCheckoutSubscription } from "@/api/generated";
import { contextErrorMessage } from "@/lib/context-errors";
import { useHouseholdStore } from "@/stores/household-store";

type BillingInterval = "monthly" | "annual";
type Result = { ok: boolean; canceled?: boolean; error?: string };

export function usePaymentSheetCheckout() {
  const householdId = useHouseholdStore((s) => s.activeHouseholdId);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const checkout = useCheckoutSubscription();
  const queryClient = useQueryClient();
  const [isBusy, setIsBusy] = useState(false);

  async function subscribe(interval: BillingInterval): Promise<Result> {
    if (!householdId) return { ok: false, error: "Selecione um contexto primeiro." };
    setIsBusy(true);
    try {
      const session = await checkout.mutateAsync({ id: householdId, data: { interval } });
      if (session.publishableKey) {
        await initStripe({ publishableKey: session.publishableKey, merchantIdentifier: "merchant.com.financeapp" });
      }
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "Finance",
        customerId: session.customerId,
        customerEphemeralKeySecret: session.ephemeralKeySecret,
        paymentIntentClientSecret: session.paymentIntentClientSecret ?? "",
        allowsDelayedPaymentMethods: false,
        returnURL: "financeapp://stripe-redirect",
      });
      if (initError) return { ok: false, error: initError.message };
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        const canceled = presentError.code === "Canceled";
        return { ok: false, canceled, error: canceled ? undefined : presentError.message };
      }
      await queryClient.invalidateQueries();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: contextErrorMessage(e) };
    } finally {
      setIsBusy(false);
    }
  }

  return { subscribe, isBusy };
}
