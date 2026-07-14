import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useEntitlements, type EntitlementFeature } from "@/hooks/use-entitlements";

export function PaywallGate({
  feature,
  title,
  children,
}: {
  feature: EntitlementFeature;
  title?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { entitlements, isLoading } = useEntitlements();
  const router = useRouter();
  if (isLoading) return null;
  if (entitlements[feature]) return <>{children}</>;
  // Screen-edge padding lives here (not in the caller) because the entitled
  // branch renders `children` as-is (e.g. InsightsFeed owns its own full-bleed
  // padding) — only this locked-CTA card needs the surrounding p-5.
  return (
    <View className="p-5">
      <Card className="gap-3">
        <Text variant="title">{title ?? t("subscription:defaultTitle")}</Text>
        <Text className="text-fg-secondary">{t("subscription:lockedMessage")}</Text>
        <Button label={t("subscription:viewPlansButton")} onPress={() => router.push("/(tabs)/settings/plan")} />
      </Card>
    </View>
  );
}
