import { useTranslation } from "react-i18next";
import { Sheet } from "@/components/ui/sheet";
import { ListRow } from "@/components/ui/list-row";

export function CategoryPickerSheet({
  visible,
  categories,
  onPick,
  onClose,
}: {
  visible: boolean;
  categories: { id: string; name: string }[];
  onPick: (name: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Sheet visible={visible} onClose={onClose} title={t("imports:categoryPickerTitle")}>
      {categories.map((c) => (
        <ListRow key={c.id} title={c.name} onPress={() => onPick(c.name)} />
      ))}
    </Sheet>
  );
}
