import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { cn } from "@/lib/utils";

export function ScreenContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <View className={cn("flex-1 px-4", className)}>{children}</View>
    </SafeAreaView>
  );
}
