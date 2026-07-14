// src/app/(tabs)/insights.tsx
import { View } from "react-native";
import { InsightsFeed } from "@/components/insights/insights-feed";
import { PaywallGate } from "@/components/subscription/paywall-gate";
import { useEntitlements } from "@/hooks/use-entitlements";

export default function InsightsScreen() {
  // InsightsFeed owns a full-bleed `flex-1 bg-bg` container with its own p-5/px-5
  // rows, so the entitled branch must not get extra screen padding here (that
  // would double it). The PaywallGate CTA (a bare Card) has no such padding of
  // its own, so it needs the screen-level p-5 every other screen uses. We read
  // the same entitlements the gate reads (cheap: react-query cache, no extra
  // fetch) purely to pick which container to render — the actual gating
  // decision still lives in PaywallGate.
  const { entitlements, isLoading } = useEntitlements();
  const showsFeed = isLoading || entitlements.aiInsights;

  return (
    <View className={showsFeed ? "flex-1 bg-bg" : "flex-1 bg-bg p-5"}>
      <PaywallGate feature="aiInsights" title="Insights com IA">
        <InsightsFeed />
      </PaywallGate>
    </View>
  );
}
