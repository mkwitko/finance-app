import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useCreateHousehold, useListHouseholds } from "@/api/generated";
import { ScreenContainer } from "@/components/layout/screen-container";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/contexts/auth-context";
import { useHouseholdStore } from "@/stores/household-store";

export default function TodayScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId);
  const setActiveHousehold = useHouseholdStore((s) => s.setActiveHousehold);
  const households = useListHouseholds();
  const createHousehold = useCreateHousehold();

  // Auto-select the first household when none is active yet.
  useEffect(() => {
    const first = households.data?.households?.[0];
    if (!activeHouseholdId && first) setActiveHousehold(first.id);
  }, [activeHouseholdId, households.data, setActiveHousehold]);

  const hasHousehold =
    Boolean(activeHouseholdId) || (households.data?.households?.length ?? 0) > 0;

  return (
    <ScreenContainer>
      <Text className="mt-2 text-2xl font-bold">
        {t("today:greeting", { name: user?.name ?? "" })}
      </Text>

      <Card className="mt-6">
        <Text className="text-xs uppercase tracking-wide text-fg-secondary">
          {t("today:nextStepTitle")}
        </Text>
        <Text className="mt-2 text-lg">{t("today:nextStepEmpty")}</Text>
      </Card>

      {!hasHousehold && (
        <Button
          className="mt-6"
          label={t("today:createHousehold")}
          loading={createHousehold.isPending}
          onPress={() =>
            createHousehold.mutate(
              { data: { name: "Meu núcleo", type: "individual" } },
              {
                onSuccess: (created) => {
                  setActiveHousehold(created.id);
                  void households.refetch();
                },
              },
            )
          }
        />
      )}
    </ScreenContainer>
  );
}
