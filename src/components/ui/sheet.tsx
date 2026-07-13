import { Modal, Pressable, View } from "react-native";
import { cn } from "@/lib/utils";
import { Text } from "./text";

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
};

export function Sheet({ visible, onClose, title, children, className }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable
          testID="sheet-backdrop"
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={onClose}
          className="absolute inset-0 bg-black/40"
        />
        <View
          className={cn(
            "rounded-t-3xl border-t border-border bg-bg-elevated p-5 pb-8",
            className,
          )}
        >
          {title ? <Text variant="title" className="mb-4">{title}</Text> : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}
