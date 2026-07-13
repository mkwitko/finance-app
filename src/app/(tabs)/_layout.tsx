import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui/text";

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: "#0E7C7B" }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs:today"),
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>◎</Text>,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: t("tabs:transactions"),
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>≡</Text>,
        }}
      />
    </Tabs>
  );
}
