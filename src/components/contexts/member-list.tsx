import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { listHouseholdsQueryKey, useListMembers, useRemoveMember, useTransferOwnership } from "@/api/generated";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { contextErrorMessage } from "@/lib/context-errors";
import { useHouseholdStore } from "@/stores/household-store";

// Self-leave uses the same remove endpoint with one's own userId. The current
// user's uuid is not needed here: "Sair" removes whichever member the caller is,
// which the backend resolves from the token when userId === self. For v1 we expose
// a per-row "Remover" (manage) and a bottom "Sair do contexto" that the parent wires
// to the caller's own userId via the `selfUserId` prop.
//
// Ownership transfer: an owner can promote any `adult` row via "Transferir
// propriedade" (explicit entry point). If the caller is the *last* owner, "Sair do
// contexto" cannot just remove them (the backend's last-owner guard would reject
// it) — instead it opens a picker of adult members and transfers to whichever one
// is picked (on-leave entry point). Both entry points call the same
// `useTransferOwnership` mutation and, on success, the caller has left the
// household: we clear the active household and route to the context switcher.
export function MemberList({
  canManage,
  selfUserId,
}: {
  canManage: boolean;
  selfUserId?: string;
}) {
  const householdId = useHouseholdStore((s) => s.activeHouseholdId);
  const setActiveHousehold = useHouseholdStore((s) => s.setActiveHousehold);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, refetch } = useListMembers(householdId ?? undefined, {
    query: { enabled: Boolean(householdId) },
  });
  const remove = useRemoveMember();
  const transfer = useTransferOwnership();
  const [error, setError] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const members = data?.members ?? [];
  const adults = members.filter((m) => m.role === "adult");
  const ownerCount = members.filter((m) => m.role === "owner").length;
  const selfRole = members.find((m) => m.userId === selfUserId)?.role;
  const isLastOwner = ownerCount === 1 && selfRole === "owner";

  const onCallerLeft = () => {
    setActiveHousehold(null);
    void queryClient.invalidateQueries({ queryKey: listHouseholdsQueryKey() });
    router.replace("/(tabs)/settings/contexts");
  };

  const removeMember = (userId: string) => {
    if (!householdId) return;
    setError(null);
    remove.mutate(
      { id: householdId, userId },
      {
        onSuccess: () => {
          void refetch();
          if (userId === selfUserId) onCallerLeft();
        },
        onError: (e: unknown) => setError(contextErrorMessage(e)),
      },
    );
  };

  const transferOwnership = (newOwnerUserId: string) => {
    if (!householdId) return;
    setError(null);
    transfer.mutate(
      { id: householdId, data: { newOwnerUserId } },
      {
        onSuccess: () => {
          setPickerVisible(false);
          onCallerLeft();
        },
        onError: (e: unknown) => setError(contextErrorMessage(e)),
      },
    );
  };

  const confirmTransfer = (member: { userId: string; name: string }) => {
    Alert.alert(
      "Transferir propriedade",
      `Você deixará o contexto e ${member.name} será o dono. Continuar?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Transferir", style: "destructive", onPress: () => transferOwnership(member.userId) },
      ],
    );
  };

  const onLeavePress = () => {
    if (!selfUserId) return;
    if (isLastOwner) {
      if (adults.length === 0) {
        setError("Promova ou convide um adulto antes de sair.");
        return;
      }
      setError(null);
      setPickerVisible(true);
      return;
    }
    removeMember(selfUserId);
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
              <View className="flex-row gap-2">
                {m.role === "adult" ? (
                  <Button
                    label="Transferir propriedade"
                    variant="ghost"
                    size="sm"
                    loading={transfer.isPending}
                    disabled={transfer.isPending}
                    onPress={() => confirmTransfer(m)}
                  />
                ) : null}
                <Button
                  label="Remover"
                  variant="ghost"
                  size="sm"
                  loading={remove.isPending}
                  disabled={remove.isPending}
                  onPress={() => removeMember(m.userId)}
                />
              </View>
            ) : undefined
          }
        />
      ))}
      {error ? <Text className="text-expense">{error}</Text> : null}
      {selfUserId ? (
        <Button
          className="mt-3"
          label="Sair do contexto"
          variant="danger"
          loading={remove.isPending || transfer.isPending}
          disabled={remove.isPending || transfer.isPending}
          onPress={onLeavePress}
        />
      ) : null}
      <Sheet visible={pickerVisible} onClose={() => setPickerVisible(false)} title="Escolher novo dono">
        {adults.map((a) => (
          <ListRow key={a.userId} title={a.name} onPress={() => transferOwnership(a.userId)} />
        ))}
      </Sheet>
    </Card>
  );
}
