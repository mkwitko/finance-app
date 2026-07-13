import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { ThemePicker } from "@/components/theme/theme-picker";

export default function ThemeSettingsScreen() {
  return (
    <View className="flex-1 gap-4 bg-bg p-5">
      <Text variant="title">Aparência</Text>
      <ThemePicker />
    </View>
  );
}
