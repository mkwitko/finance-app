// src/app/(tabs)/insights.tsx
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { InsightsFeed } from "@/components/insights/insights-feed";
import { PaywallGate } from "@/components/subscription/paywall-gate";

// InsightsFeed owns a full-bleed `flex-1 bg-bg` container with its own p-5/px-5
// rows, and PaywallGate's locked-CTA branch pads itself — so this screen just
// needs a single flex-1 wrapper regardless of entitlement. The gating decision
// (and its single `useEntitlements` read) lives entirely in PaywallGate.
export default function InsightsScreen() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 bg-bg">
      <PaywallGate feature="aiInsights" title={t("insights:paywallTitle")}>
        <InsightsFeed />
      </PaywallGate>
    </View>
  );
}
