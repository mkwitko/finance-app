import { useEffect, useState } from "react";
import { View } from "react-native";
import { useRedeemInvitation } from "@/api/generated";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Text } from "@/components/ui/text";
import { contextErrorMessage } from "@/lib/context-errors";
import { useHouseholdStore } from "@/stores/household-store";

export function RedeemCodeForm({
  initialCode = "",
  onJoined,
}: {
  initialCode?: string;
  onJoined: (h: { id: string }) => void;
}) {
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState<string | null>(null);
  const setActive = useHouseholdStore((s) => s.setActiveHousehold);
  const redeem = useRedeemInvitation();

  useEffect(() => {
    setCode(initialCode);
  }, [initialCode]);

  const submit = () => {
    if (code.trim().length === 0) return;
    setError(null);
    redeem.mutate(
      { code: code.trim() },
      {
        onSuccess: (h: { id: string }) => {
          setActive(h.id);
          onJoined(h);
        },
        onError: (e: unknown) => setError(contextErrorMessage(e)),
      },
    );
  };

  return (
    <View className="gap-4">
      <Field label="Código do convite" placeholder="Cole o código" value={code} onChangeText={setCode} autoCapitalize="none" testID="code-input" />
      {error ? <Text className="text-expense">{error}</Text> : null}
      <Button label="Entrar" onPress={submit} loading={redeem.isPending} disabled={code.trim().length === 0} />
    </View>
  );
}
