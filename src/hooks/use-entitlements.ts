import { useGetSubscription } from "@/api/generated";
import { useHouseholdStore } from "@/stores/household-store";

export type Entitlements = {
  aiInsights: boolean;
  futureProjection: boolean;
  unlimitedContexts: boolean;
  maxContexts: number;
};
export type EntitlementFeature = "aiInsights" | "futureProjection" | "unlimitedContexts";

const FREE: Entitlements = { aiInsights: false, futureProjection: false, unlimitedContexts: false, maxContexts: 2 };

export function useEntitlements() {
  const householdId = useHouseholdStore((s) => s.activeHouseholdId);
  const { data, isLoading } = useGetSubscription(householdId ?? undefined, {
    query: { enabled: Boolean(householdId) },
  });
  const sub = data as { plan?: "free" | "premium"; entitlements?: Entitlements } | undefined;
  const plan = sub?.plan ?? "free";
  return {
    plan,
    isPremium: plan === "premium",
    entitlements: sub?.entitlements ?? FREE,
    isLoading,
  };
}

export function useEntitlement(feature: EntitlementFeature): boolean {
  return useEntitlements().entitlements[feature];
}
