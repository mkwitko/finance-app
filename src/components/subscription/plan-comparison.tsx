import { View } from "react-native";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";

const FEATURES = [
  "Insights com IA",
  "Projeção financeira futura",
  "Contextos ilimitados",
];

export function PlanComparison() {
  return (
    <Card className="gap-3">
      <Text variant="title">Premium</Text>
      <Text className="text-fg-secondary">Desbloqueie tudo do Finance:</Text>
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
