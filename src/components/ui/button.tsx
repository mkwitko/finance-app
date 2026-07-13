import { ActivityIndicator, Pressable, type PressableProps } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "./text";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const CONTAINER: Record<Variant, string> = {
  primary: "bg-accent",
  secondary: "bg-bg-elevated border border-border",
  ghost: "bg-transparent",
  danger: "bg-expense",
};

const LABEL: Record<Variant, string> = {
  primary: "text-accent-fg",
  secondary: "text-fg",
  ghost: "text-accent",
  danger: "text-accent-fg",
};

const SIZE: Record<Size, string> = {
  sm: "min-h-[36px] px-3 py-2",
  md: "min-h-[48px] px-5 py-3",
  lg: "min-h-[56px] px-6 py-4",
};

type Props = Omit<PressableProps, "children"> & {
  label: string;
  loading?: boolean;
  variant?: Variant;
  size?: Size;
  className?: string;
};

export function Button({
  label,
  loading = false,
  variant = "primary",
  size = "md",
  className,
  disabled,
  ...props
}: Props) {
  const isDisabled = disabled === true || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      className={cn(
        "flex-row items-center justify-center rounded-2xl",
        SIZE[size],
        CONTAINER[variant],
        isDisabled && "opacity-50",
        className,
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator />
      ) : (
        <Text className={cn("font-semibold", LABEL[variant])}>{label}</Text>
      )}
    </Pressable>
  );
}
