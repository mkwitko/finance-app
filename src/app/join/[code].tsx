import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { RedeemCodeForm } from "@/components/contexts/redeem-code-form";
import { Text } from "@/components/ui/text";

export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return (
    <View className="flex-1 gap-4 bg-bg p-5">
      <Text variant="title">Entrar em um contexto</Text>
      <RedeemCodeForm initialCode={code ?? ""} onJoined={() => router.replace("/(tabs)")} />
    </View>
  );
}
