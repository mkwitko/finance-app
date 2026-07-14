import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";

export function PlanComparison() {
  const { t } = useTranslation();
  const FEATURES = [
    t("subscription:features.aiInsights"),
    t("subscription:features.futureProjection"),
    t("subscription:features.unlimitedContexts"),
  ];
  return (
    <Card className="gap-3">
      <Text variant="title">{t("subscription:premiumTitle")}</Text>
      <Text className="text-fg-secondary">{t("subscription:unlockAll")}</Text>
      <View className="gap-2">
        {FEATURES.map((f) => (
          <View key={f} className="flex-row items-center gap-2">
            <Text className="text-accent">✓</Text>
            <Text>{f}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
