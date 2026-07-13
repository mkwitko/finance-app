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
  return (
    <Sheet visible={visible} onClose={onClose} title="Escolher categoria">
      {categories.map((c) => (
        <ListRow key={c.id} title={c.name} onPress={() => onPick(c.name)} />
      ))}
    </Sheet>
  );
}
