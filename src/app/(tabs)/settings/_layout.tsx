import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

export default function SettingsLayout() {
  const { t } = useTranslation();
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: t("tabs:settings"), headerShown: false }} />
      <Stack.Screen name="plan" options={{ title: t("subscription:screenTitle") }} />
      <Stack.Screen name="members" options={{ title: t("members:title") }} />
      <Stack.Screen name="contexts" options={{ title: t("contexts:title") }} />
      <Stack.Screen name="theme" options={{ title: t("settings:themeTitle") }} />
    </Stack>
  );
}
