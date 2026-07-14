import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { AmountText } from "@/components/ui/amount-text";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";

type Row = {
  description: string;
  amountCents: number;
  direction: "in" | "out";
  suggestedCategory: string | null;
  duplicate: boolean;
};

export function ReviewRow({
  row,
  included,
  onToggle,
  onEditCategory,
}: {
  row: Row;
  included: boolean;
  onToggle: () => void;
  onEditCategory: () => void;
}) {
  const { t } = useTranslation();
  const signed = row.direction === "out" ? -row.amountCents : row.amountCents;
  return (
    <View className="flex-row items-center gap-3 border-b border-border py-3">
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: included }}
        onPress={onToggle}
        className={cn(
          "h-6 w-6 items-center justify-center rounded-md border-2 border-accent",
          included ? "bg-accent" : "bg-transparent",
        )}
      >
        {included ? <Text className="text-xs text-accent-fg">✓</Text> : null}
      </Pressable>
      <View className="flex-1 gap-1">
        <View className="flex-row items-baseline gap-2">
          <Text className="text-fg flex-1">{row.description}</Text>
          {row.duplicate ? <Text className="text-xs text-warning">{t("imports:duplicateLabel")}</Text> : null}
        </View>
        <Pressable accessibilityRole="button" onPress={onEditCategory} className="self-start">
          <Badge label={row.suggestedCategory ?? t("imports:noCategory")} tone="neutral" />
        </Pressable>
      </View>
      <AmountText cents={signed} />
    </View>
  );
}
