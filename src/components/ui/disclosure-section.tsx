import { useState } from "react";
import { Pressable, View } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "./text";

export function DisclosureSection({
  title,
  defaultOpen = false,
  children,
  className,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View className={cn("gap-2", className)}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center justify-between py-2"
      >
        <Text className="text-fg font-semibold">{title}</Text>
        <Text className="text-fg-secondary">{open ? "−" : "+"}</Text>
      </Pressable>
      {open ? <View>{children}</View> : null}
    </View>
  );
}
