import { View } from "react-native";
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
const SEVERITY_LABEL: Record<Severity, string> = {
  info: "Info",
  warning: "Atenção",
  positive: "Positivo",
};

export function InsightCard({ insight }: { insight: Insight }) {
  return (
    <Card className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text variant="title">{insight.title}</Text>
        <Badge
          label={SEVERITY_LABEL[insight.severity] ?? "Info"}
          tone={TONE[insight.severity] ?? "neutral"}
        />
      </View>
      <Text className="text-fg-secondary">{insight.body}</Text>
      {insight.recommendation ? (
        <DisclosureSection title="Ver recomendação">
          <Text className="text-fg">{insight.recommendation}</Text>
        </DisclosureSection>
      ) : null}
    </Card>
  );
}
