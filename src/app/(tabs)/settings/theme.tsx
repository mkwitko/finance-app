import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui/text";
import { ThemePicker } from "@/components/theme/theme-picker";

export default function ThemeSettingsScreen() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 gap-4 bg-bg p-5">
      <Text variant="title">{t("theme:screenTitle")}</Text>
      <ThemePicker />
    </View>
  );
}
