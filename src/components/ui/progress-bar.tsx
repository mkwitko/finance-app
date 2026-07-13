import { View } from "react-native";
import { cn } from "@/lib/utils";

export function ProgressBar({ value, className, testID }: { value: number; className?: string; testID?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{ now: pct, min: 0, max: 100 }}
      className={cn("h-1.5 overflow-hidden rounded-full bg-border", className)}
    >
      <View className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
    </View>
  );
}
