import { useRouter } from "expo-router";
import { View } from "react-native";
import { ListRow } from "@/components/ui/list-row";
import { Text } from "@/components/ui/text";

const ENTRIES = [
  { label: "Plano", route: "/(tabs)/settings/plan" },
  { label: "Membros", route: "/(tabs)/settings/members" },
  { label: "Contextos", route: "/(tabs)/settings/contexts" },
  { label: "Tema", route: "/(tabs)/settings/theme" },
] as const;

export default function SettingsHub() {
  const router = useRouter();
  return (
    <View className="flex-1 gap-2 bg-bg p-5">
      <Text variant="title">Ajustes</Text>
      {ENTRIES.map((e) => (
        <ListRow key={e.route} title={e.label} onPress={() => router.push(e.route)} />
      ))}
    </View>
  );
}
