import { Pressable, View } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "./text";

type Props = {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  className?: string;
};

export function ListRow({ title, subtitle, leading, trailing, onPress, className }: Props) {
  const Container = onPress ? Pressable : View;
  return (
    <Container
      {...(onPress ? { onPress, accessibilityRole: "button" } : {})}
      className={cn("flex-row items-center gap-3 border-b border-border py-3", className)}
    >
      {leading}
      <View className="flex-1">
        <Text className="text-fg">{title}</Text>
        {subtitle ? <Text variant="caption">{subtitle}</Text> : null}
      </View>
      {trailing}
    </Container>
  );
}
