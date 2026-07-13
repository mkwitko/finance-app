import { TextInput, View, type TextInputProps } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "./text";

type Props = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
};

export function Field({ label, error, hint, className, ...props }: Props) {
  return (
    <View className={cn("gap-1", className)}>
      <Text variant="label">{label}</Text>
      <TextInput
        className={cn(
          "min-h-[48px] rounded-xl border bg-bg-elevated px-4 text-base text-fg",
          error ? "border-expense" : "border-border",
        )}
        placeholderTextColor="rgb(var(--fg-secondary))"
        {...props}
      />
      {error ? (
        <Text className="text-sm text-expense">{error}</Text>
      ) : hint ? (
        <Text variant="caption">{hint}</Text>
      ) : null}
    </View>
  );
}
