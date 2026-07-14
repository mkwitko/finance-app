import { useRouter } from "expo-router";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { ListRow } from "@/components/ui/list-row";
import { Text } from "@/components/ui/text";

export default function SettingsHub() {
  const { t } = useTranslation();
  const router = useRouter();
  const ENTRIES = [
    { label: t("subscription:screenTitle"), route: "/(tabs)/settings/plan" },
    { label: t("members:title"), route: "/(tabs)/settings/members" },
    { label: t("contexts:title"), route: "/(tabs)/settings/contexts" },
    { label: t("settings:themeTitle"), route: "/(tabs)/settings/theme" },
  ] as const;
  return (
    <View className="flex-1 gap-2 bg-bg p-5">
      <Text variant="title">{t("tabs:settings")}</Text>
      {ENTRIES.map((e) => (
        <ListRow key={e.route} title={e.label} onPress={() => router.push(e.route)} />
      ))}
    </View>
  );
}
