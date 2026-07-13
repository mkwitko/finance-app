import { View, type ViewProps } from "react-native";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={cn("h-4 animate-pulse rounded-md bg-border", className)} {...props} />;
}
