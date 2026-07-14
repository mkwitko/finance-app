import { useState } from "react";
import { Alert, View } from "react-native";
import { useCancelSubscription, useGetSubscription, useSwitchSubscriptionInterval } from "@/api/generated";
import { PlanComparison } from "@/components/subscription/plan-comparison";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Text } from "@/components/ui/text";
import { usePaymentSheetCheckout } from "@/hooks/use-payment-sheet-checkout";
import { contextErrorMessage } from "@/lib/context-errors";
import { useHouseholdStore } from "@/stores/household-store";

type Interval = "monthly" | "annual";
const INTERVALS: { value: Interval; label: string }[] = [
  { value: "monthly", label: "Mensal" },
  { value: "annual", label: "Anual" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
}

export default function PlanScreen() {
  const householdId = useHouseholdStore((s) => s.activeHouseholdId);
  const { data, refetch } = useGetSubscription(householdId ?? undefined, {
    query: { enabled: Boolean(householdId) },
  });
  const sub = data as
    | { plan: "free" | "premium"; status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; interval: Interval | null }
    | undefined;

  const { subscribe, isBusy } = usePaymentSheetCheckout();
  const switchInterval = useSwitchSubscriptionInterval();
  const cancel = useCancelSubscription();
  const [interval, setInterval] = useState<Interval>("monthly");
  const [error, setError] = useState<string | null>(null);

  const isPremium = sub?.plan === "premium";

  async function onSubscribe() {
    setError(null);
    const res = await subscribe(interval);
    if (res.ok) void refetch();
    else if (!res.canceled && res.error) setError(res.error);
  }

  function onSwitch(next: Interval) {
    if (!householdId) return;
    setError(null);
    switchInterval.mutate(
      { id: householdId, data: { interval: next } },
      { onSuccess: () => void refetch(), onError: (e: unknown) => setError(contextErrorMessage(e)) },
    );
  }

  function onCancel() {
    if (!householdId) return;
    Alert.alert("Cancelar assinatura", "Você manterá o acesso até o fim do período pago. Confirmar?", [
      { text: "Voltar", style: "cancel" },
      {
        text: "Cancelar assinatura",
        style: "destructive",
        onPress: () =>
          cancel.mutate(
            { id: householdId },
            { onSuccess: () => void refetch(), onError: (e: unknown) => setError(contextErrorMessage(e)) },
          ),
      },
    ]);
  }

  return (
    <View className="flex-1 gap-4 bg-bg p-5">
      <Text variant="title">Plano</Text>

      {!isPremium ? (
        <>
          <PlanComparison />
          <View className="gap-2">
            <Text variant="label">Ciclo de cobrança</Text>
            <Segmented options={INTERVALS} value={interval} onChange={setInterval} />
          </View>
          <Button label="Assinar Premium" loading={isBusy} onPress={onSubscribe} />
        </>
      ) : (
        <>
          <Card className="gap-2">
            <Text variant="title">Premium</Text>
            <Text className="text-fg-secondary">
              {sub?.interval === "annual" ? "Cobrança anual" : "Cobrança mensal"}
            </Text>
            {sub?.currentPeriodEnd ? (
              <Text className="text-fg-secondary">
                {sub.cancelAtPeriodEnd
                  ? `Acesso até ${formatDate(sub.currentPeriodEnd)}`
                  : `Renova em ${formatDate(sub.currentPeriodEnd)}`}
              </Text>
            ) : null}
          </Card>

          {!sub?.cancelAtPeriodEnd ? (
            <>
              <View className="gap-2">
                <Text variant="label">Mudar ciclo</Text>
                <Segmented
                  options={INTERVALS}
                  value={sub?.interval ?? "monthly"}
                  onChange={onSwitch}
                />
              </View>
              <Button label="Cancelar assinatura" variant="danger" loading={cancel.isPending} onPress={onCancel} />
            </>
          ) : null}
        </>
      )}

      {error ? <Text className="text-expense">{error}</Text> : null}
    </View>
  );
}
