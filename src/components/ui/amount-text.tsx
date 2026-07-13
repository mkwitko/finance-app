import { cn, formatCents } from "@/lib/utils";
import { Text } from "./text";
import type { TextProps } from "react-native";

export function AmountText({
  cents,
  colorize = true,
  className,
  ...props
}: TextProps & { cents: number; colorize?: boolean; className?: string }) {
  const color = !colorize
    ? "text-fg"
    : cents > 0
      ? "text-income"
      : cents < 0
        ? "text-expense"
        : "text-neutral";
  return (
    <Text className={cn("font-semibold", color, className)} {...props}>
      {formatCents(cents)}
    </Text>
  );
}
