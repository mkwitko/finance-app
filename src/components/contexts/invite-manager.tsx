import { useState } from "react";
import { Share, View } from "react-native";
import { useCreateInvitation, useListInvitations, useRevokeInvitation } from "@/api/generated";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { Segmented } from "@/components/ui/segmented";
import { Text } from "@/components/ui/text";
import { contextErrorMessage } from "@/lib/context-errors";
import { useHouseholdStore } from "@/stores/household-store";

type Role = "adult" | "teen" | "viewer";
const ROLES: { value: Role; label: string }[] = [
  { value: "adult", label: "Adulto" },
  { value: "teen", label: "Adolescente" },
  { value: "viewer", label: "Visualizador" },
];
const EXPIRIES: { value: string; label: string }[] = [
  { value: "24", label: "1 dia" },
  { value: "168", label: "7 dias" },
  { value: "720", label: "30 dias" },
];

export function InviteManager() {
  const householdId = useHouseholdStore((s) => s.activeHouseholdId);
  const [role, setRole] = useState<Role>("adult");
  const [expiry, setExpiry] = useState("168");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateInvitation();
  const revoke = useRevokeInvitation();
  const { data, refetch } = useListInvitations(householdId ?? undefined, {
    query: { enabled: Boolean(householdId) },
  });

  const generate = () => {
    if (!householdId) return;
    setError(null);
    create.mutate(
      { id: householdId, data: { role, expiresInHours: Number(expiry) } },
      {
        onSuccess: (inv: { url: string }) => {
          void Share.share({ message: inv.url });
          void refetch();
        },
        onError: (e: unknown) => setError(contextErrorMessage(e)),
      },
    );
  };

  const invitations = data?.invitations ?? [];

  return (
    <Card className="gap-4">
      <View className="gap-2">
        <Text variant="label">Papel do convidado</Text>
        <Segmented options={ROLES} value={role} onChange={setRole} />
      </View>
      <View className="gap-2">
        <Text variant="label">Validade</Text>
        <Segmented options={EXPIRIES} value={expiry} onChange={setExpiry} />
      </View>
      <Button label="Gerar convite" onPress={generate} loading={create.isPending} disabled={!householdId} />
      {error ? <Text className="text-expense">{error}</Text> : null}
      {invitations.map((inv) => (
        <ListRow
          key={inv.id}
          title={inv.code}
          subtitle={`Papel: ${inv.role}`}
          trailing={
            householdId ? (
              <Button
                label="Revogar"
                variant="ghost"
                size="sm"
                loading={revoke.isPending}
                disabled={revoke.isPending}
                onPress={() => {
                  setError(null);
                  revoke.mutate(
                    { id: householdId, invId: inv.id },
                    {
                      onSuccess: () => void refetch(),
                      onError: (e: unknown) => setError(contextErrorMessage(e)),
                    },
                  );
                }}
              />
            ) : undefined
          }
        />
      ))}
    </Card>
  );
}
