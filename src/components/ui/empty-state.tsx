import { View } from "react-native";
import { Button } from "./button";
import { Text } from "./text";

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View className="items-center gap-2 p-8">
      <Text variant="title">{title}</Text>
      {message ? <Text variant="caption" className="text-center">{message}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} className="mt-2" />
      ) : null}
    </View>
  );
}
