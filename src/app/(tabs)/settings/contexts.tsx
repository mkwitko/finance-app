import { useState } from "react";
import { View } from "react-native";
import { ContextSwitcher } from "@/components/contexts/context-switcher";
import { CreateContextForm } from "@/components/contexts/create-context-form";
import { RedeemCodeForm } from "@/components/contexts/redeem-code-form";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";

export default function ContextsScreen() {
  const [switcher, setSwitcher] = useState(false);
  const [creating, setCreating] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  return (
    <View className="flex-1 gap-4 bg-bg p-5">
      <Text variant="title">Contextos</Text>
      <Button label="Trocar contexto" onPress={() => setSwitcher(true)} />
      <ContextSwitcher
        visible={switcher}
        onClose={() => setSwitcher(false)}
        onCreate={() => {
          setSwitcher(false);
          setCreating(true);
        }}
        onRedeem={() => {
          setSwitcher(false);
          setRedeeming(true);
        }}
      />
      <Sheet visible={creating} onClose={() => setCreating(false)} title="Criar contexto">
        <CreateContextForm onCreated={() => setCreating(false)} />
      </Sheet>
      <Sheet visible={redeeming} onClose={() => setRedeeming(false)} title="Entrar com código">
        <RedeemCodeForm onJoined={() => setRedeeming(false)} />
      </Sheet>
    </View>
  );
}
