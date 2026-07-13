import { View } from "react-native";
import { useListHouseholds } from "@/api/generated";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow } from "@/components/ui/list-row";
import { Sheet } from "@/components/ui/sheet";
import { useHouseholdStore } from "@/stores/household-store";

const TYPE_LABEL: Record<string, string> = {
  individual: "Pessoal",
  family: "Família",
  shared: "Casal",
  kids: "Criança",
};

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
  const activeId = useHouseholdStore((s) => s.activeHouseholdId);
  const setActive = useHouseholdStore((s) => s.setActiveHousehold);
  const { data } = useListHouseholds();
  const households = data?.households ?? [];

  return (
    <Sheet visible={visible} onClose={onClose} title="Contextos">
      {households.length === 0 ? (
        <EmptyState title="Nenhum contexto" message="Crie seu primeiro contexto para começar." />
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
              trailing={h.id === activeId ? <Badge label="Ativo" tone="income" /> : undefined}
            />
          ))}
        </View>
      )}
      <View className="mt-4 gap-2">
        <Button label="Criar contexto" variant="primary" onPress={onCreate} />
        <Button label="Entrar com código" variant="secondary" onPress={onRedeem} />
      </View>
    </Sheet>
  );
}
