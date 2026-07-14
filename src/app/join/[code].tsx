import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { RedeemCodeForm } from "@/components/contexts/redeem-code-form";
import { Text } from "@/components/ui/text";

export default function JoinScreen() {
  const { t } = useTranslation();
  const { code } = useLocalSearchParams<{ code: string }>();
  return (
    <View className="flex-1 gap-4 bg-bg p-5">
      <Text variant="title">{t("contexts:joinTitle")}</Text>
      <RedeemCodeForm initialCode={code ?? ""} onJoined={() => router.replace("/(tabs)")} />
    </View>
  );
}
