import { Text as RNText, type TextProps } from "react-native";
import { cn } from "@/lib/utils";

type Variant = "display" | "title" | "body" | "caption" | "label";

const VARIANTS: Record<Variant, string> = {
  display: "text-3xl font-bold text-fg",
  title: "text-xl font-semibold text-fg",
  body: "text-base text-fg",
  caption: "text-sm text-fg-secondary",
  label: "text-xs uppercase tracking-wide text-fg-secondary",
};

// Themed text primitive. NativeWind resolves `className` (see nativewind-env.d.ts).
export function Text({
  variant = "body",
  className,
  ...props
}: TextProps & { variant?: Variant; className?: string }) {
  return (
    <RNText className={cn(VARIANTS[variant], className)} {...props} />
  );
}
