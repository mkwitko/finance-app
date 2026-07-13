import { useState } from "react";
import { View } from "react-native";
import { useCreateHousehold } from "@/api/generated";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Text } from "@/components/ui/text";
import { contextErrorMessage } from "@/lib/context-errors";

type ContextType = "individual" | "family" | "shared" | "kids";
const TYPES: { value: ContextType; label: string }[] = [
  { value: "individual", label: "Pessoal" },
  { value: "family", label: "Família" },
  { value: "shared", label: "Casal" },
  { value: "kids", label: "Criança" },
];

export function CreateContextForm({ onCreated }: { onCreated: (h: { id: string }) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ContextType>("individual");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateHousehold();

  const submit = () => {
    if (name.trim().length === 0) return;
    setError(null);
    create.mutate(
      { data: { name: name.trim(), type } },
      {
        onSuccess: (h: { id: string }) => onCreated(h),
        onError: (e: unknown) => setError(contextErrorMessage(e)),
      },
    );
  };

  return (
    <View className="gap-4">
      <Field
        label="Nome"
        placeholder="Nome do contexto"
        value={name}
        onChangeText={setName}
        testID="name-input"
      />
      <View className="gap-2">
        <Text variant="label">Tipo</Text>
        <Segmented options={TYPES} value={type} onChange={setType} />
      </View>
      {error ? <Text className="text-expense">{error}</Text> : null}
      <Button label="Criar" onPress={submit} loading={create.isPending} disabled={name.trim().length === 0} />
    </View>
  );
}
