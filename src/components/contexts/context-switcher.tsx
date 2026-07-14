import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useListHouseholds } from "@/api/generated";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow } from "@/components/ui/list-row";
import { Sheet } from "@/components/ui/sheet";
import { useHouseholdStore } from "@/stores/household-store";

export function ContextSwitcher({
  visible,
  onClose,
  onCreate,
  onRedeem,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: () => void;
  onRedeem: () => void;
}) {
  const { t } = useTranslation();
  const TYPE_LABEL: Record<string, string> = {
    individual: t("contexts:types.individual"),
    family: t("contexts:types.family"),
    shared: t("contexts:types.shared"),
    kids: t("contexts:types.kids"),
  };
  const activeId = useHouseholdStore((s) => s.activeHouseholdId);
  const setActive = useHouseholdStore((s) => s.setActiveHousehold);
  const { data } = useListHouseholds();
  const households = data?.households ?? [];

  return (
    <Sheet visible={visible} onClose={onClose} title={t("contexts:title")}>
      {households.length === 0 ? (
        <EmptyState title={t("contexts:emptyTitle")} message={t("contexts:emptyMessage")} />
      ) : (
        <View>
          {households.map((h) => (
            <ListRow
              key={h.id}
              title={h.name}
              onPress={() => {
                setActive(h.id);
                onClose();
              }}
              leading={<Badge label={TYPE_LABEL[h.type] ?? h.type} />}
              trailing={h.id === activeId ? <Badge label={t("contexts:active")} tone="income" /> : undefined}
            />
          ))}
        </View>
      )}
      <View className="mt-4 gap-2">
        <Button label={t("contexts:createButton")} variant="primary" onPress={onCreate} />
        <Button label={t("contexts:redeemButton")} variant="secondary" onPress={onRedeem} />
      </View>
    </Sheet>
  );
}
