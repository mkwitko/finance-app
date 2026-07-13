import { useListMembers, useRemoveMember } from "@/api/generated";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { useHouseholdStore } from "@/stores/household-store";

// Self-leave uses the same remove endpoint with one's own userId. The current
// user's uuid is not needed here: "Sair" removes whichever member the caller is,
// which the backend resolves from the token when userId === self. For v1 we expose
// a per-row "Remover" (manage) and a bottom "Sair do contexto" that the parent wires
// to the caller's own userId via the `selfUserId` prop.
export function MemberList({
  canManage,
  selfUserId,
}: {
  canManage: boolean;
  selfUserId?: string;
}) {
  const householdId = useHouseholdStore((s) => s.activeHouseholdId);
  const { data, refetch } = useListMembers(householdId ?? undefined, {
    query: { enabled: Boolean(householdId) },
  });
  const remove = useRemoveMember();
  const members = data?.members ?? [];

  const removeMember = (userId: string) => {
    if (!householdId) return;
    remove.mutate({ id: householdId, userId }, { onSuccess: () => void refetch() });
  };

  return (
    <Card className="gap-1">
      {members.map((m) => (
        <ListRow
          key={m.userId}
          title={m.name}
          leading={<Badge label={m.role} />}
          trailing={
            canManage && m.userId !== selfUserId ? (
              <Button label="Remover" variant="ghost" size="sm" onPress={() => removeMember(m.userId)} />
            ) : undefined
          }
        />
      ))}
      {selfUserId ? (
        <Button
          className="mt-3"
          label="Sair do contexto"
          variant="danger"
          onPress={() => removeMember(selfUserId)}
        />
      ) : null}
    </Card>
  );
}
