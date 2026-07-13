import { View } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "./text";

type Tone = "neutral" | "income" | "expense" | "warning" | "investment";
const TEXT: Record<Tone, string> = {
  neutral: "text-neutral",
  income: "text-income",
  expense: "text-expense",
  warning: "text-warning",
  investment: "text-investment",
};

export function Badge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return (
    <View className="self-start rounded-full border border-border px-2 py-0.5">
      <Text className={cn("text-xs font-semibold", TEXT[tone])}>{label}</Text>
    </View>
  );
}
