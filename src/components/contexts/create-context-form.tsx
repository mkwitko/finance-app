import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useCreateHousehold } from "@/api/generated";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Text } from "@/components/ui/text";
import { contextErrorMessage } from "@/lib/context-errors";
import { useHouseholdStore } from "@/stores/household-store";

type ContextType = "individual" | "family" | "shared" | "kids";

export function CreateContextForm({ onCreated }: { onCreated: (h: { id: string }) => void }) {
  const { t } = useTranslation();
  const TYPES: { value: ContextType; label: string }[] = [
    { value: "individual", label: t("contexts:types.individual") },
    { value: "family", label: t("contexts:types.family") },
    { value: "shared", label: t("contexts:types.shared") },
    { value: "kids", label: t("contexts:types.kids") },
  ];
  const [name, setName] = useState("");
  const [type, setType] = useState<ContextType>("individual");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateHousehold();
  const setActive = useHouseholdStore((s) => s.setActiveHousehold);

  const submit = () => {
    if (name.trim().length === 0) return;
    setError(null);
    create.mutate(
      { data: { name: name.trim(), type } },
      {
        onSuccess: (h: { id: string }) => {
          setActive(h.id);
          onCreated(h);
        },
        onError: (e: unknown) => setError(contextErrorMessage(e)),
      },
    );
  };

  return (
    <View className="gap-4">
      <Field
        label={t("contexts:form.nameLabel")}
        placeholder={t("contexts:form.namePlaceholder")}
        value={name}
        onChangeText={setName}
        testID="name-input"
      />
      <View className="gap-2">
        <Text variant="label">{t("contexts:form.typeLabel")}</Text>
        <Segmented options={TYPES} value={type} onChange={setType} />
      </View>
      {error ? <Text className="text-expense">{error}</Text> : null}
      <Button label={t("contexts:form.submit")} onPress={submit} loading={create.isPending} disabled={name.trim().length === 0} />
    </View>
  );
}
