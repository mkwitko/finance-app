import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useEntitlement, type EntitlementFeature } from "@/hooks/use-entitlements";

export function PaywallGate({
  feature,
  title,
  children,
}: {
  feature: EntitlementFeature;
  title?: string;
  children: ReactNode;
}) {
  const entitled = useEntitlement(feature);
  const router = useRouter();
  if (entitled) return <>{children}</>;
  return (
    <Card className="gap-3">
      <Text variant="title">{title ?? "Recurso Premium"}</Text>
      <Text className="text-fg-secondary">Assine o Premium para desbloquear este recurso.</Text>
      <Button label="Ver planos" onPress={() => router.push("/(tabs)/settings/plan")} />
    </Card>
  );
}
