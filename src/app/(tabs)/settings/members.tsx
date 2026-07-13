import { View } from "react-native";
import { InviteManager } from "@/components/contexts/invite-manager";
import { MemberList } from "@/components/contexts/member-list";
import { Text } from "@/components/ui/text";

export default function MembersScreen() {
  return (
    <View className="flex-1 gap-4 bg-bg p-5">
      <Text variant="title">Membros</Text>
      <MemberList canManage />
      <Text variant="title">Convites</Text>
      <InviteManager />
    </View>
  );
}
