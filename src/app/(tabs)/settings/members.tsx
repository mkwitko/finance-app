import { View } from "react-native";
import { useListHouseholds } from "@/api/generated";
import { InviteManager } from "@/components/contexts/invite-manager";
import { MemberList } from "@/components/contexts/member-list";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import { useHouseholdStore } from "@/stores/household-store";

export default function MembersScreen() {
  const selfUserId = useAuth().user?.sub;
  const activeId = useHouseholdStore((s) => s.activeHouseholdId);
  const role = useListHouseholds().data?.households?.find((h) => h.id === activeId)?.role;
  const canManage = role === "owner";

  return (
    <View className="flex-1 gap-4 bg-bg p-5">
      <Text variant="title">Membros</Text>
      <MemberList canManage={canManage} selfUserId={selfUserId} />
      {role === "owner" || role === "adult" ? (
        <>
          <Text variant="title">Convites</Text>
          <InviteManager />
        </>
      ) : null}
    </View>
  );
}
