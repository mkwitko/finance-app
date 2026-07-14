import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DisclosureSection } from "@/components/ui/disclosure-section";
import { Text } from "@/components/ui/text";

type Severity = "info" | "warning" | "positive";
type Insight = {
  kind: string;
  severity: Severity;
  title: string;
  body: string;
  recommendation: string | null;
};

const TONE: Record<Severity, "neutral" | "warning" | "income"> = {
  info: "neutral",
  warning: "warning",
  positive: "income",
};

export function InsightCard({ insight }: { insight: Insight }) {
  const { t } = useTranslation();
  const SEVERITY_LABEL: Record<Severity, string> = {
    info: t("insights:severity.info"),
    warning: t("insights:severity.warning"),
    positive: t("insights:severity.positive"),
  };
  return (
    <Card className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text variant="title">{insight.title}</Text>
        <Badge
          label={SEVERITY_LABEL[insight.severity] ?? t("insights:severity.info")}
          tone={TONE[insight.severity] ?? "neutral"}
        />
      </View>
      <Text className="text-fg-secondary">{insight.body}</Text>
      {insight.recommendation ? (
        <DisclosureSection title={t("insights:viewRecommendation")}>
          <Text className="text-fg">{insight.recommendation}</Text>
        </DisclosureSection>
      ) : null}
    </Card>
  );
}
