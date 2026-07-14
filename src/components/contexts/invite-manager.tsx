import { useState } from "react";
import { Share, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useCreateInvitation, useListInvitations, useRevokeInvitation } from "@/api/generated";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { Segmented } from "@/components/ui/segmented";
import { Text } from "@/components/ui/text";
import { contextErrorMessage } from "@/lib/context-errors";
import { useHouseholdStore } from "@/stores/household-store";

type Role = "adult" | "teen" | "viewer";

export function InviteManager() {
  const { t } = useTranslation();
  const ROLES: { value: Role; label: string }[] = [
    { value: "adult", label: t("invites:roles.adult") },
    { value: "teen", label: t("invites:roles.teen") },
    { value: "viewer", label: t("invites:roles.viewer") },
  ];
  const EXPIRIES: { value: string; label: string }[] = [
    { value: "24", label: t("invites:expiries.day") },
    { value: "168", label: t("invites:expiries.week") },
    { value: "720", label: t("invites:expiries.month") },
  ];
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
        <Text variant="label">{t("invites:roleLabel")}</Text>
        <Segmented options={ROLES} value={role} onChange={setRole} />
      </View>
      <View className="gap-2">
        <Text variant="label">{t("invites:expiryLabel")}</Text>
        <Segmented options={EXPIRIES} value={expiry} onChange={setExpiry} />
      </View>
      <Button label={t("invites:generateButton")} onPress={generate} loading={create.isPending} disabled={!householdId} />
      {error ? <Text className="text-expense">{error}</Text> : null}
      {invitations.map((inv) => (
        <ListRow
          key={inv.id}
          title={inv.code}
          subtitle={t("invites:roleRow", { role: inv.role })}
          trailing={
            householdId ? (
              <Button
                label={t("invites:revokeButton")}
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
