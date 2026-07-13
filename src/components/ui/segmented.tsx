import { Pressable, View } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "./text";

type Option<T extends string> = { value: T; label: string };

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <View className={cn("flex-row rounded-xl bg-bg-elevated p-1", className)}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(opt.value)}
            className={cn("flex-1 items-center rounded-lg py-2", selected && "bg-bg")}
          >
            <Text
              className={cn(
                "text-sm font-semibold",
                selected ? "text-accent" : "text-fg-secondary",
              )}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
