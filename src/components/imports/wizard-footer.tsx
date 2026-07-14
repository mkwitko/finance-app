import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function WizardFooter({
  primaryLabel,
  onPrimary,
  onBack,
  primaryLoading,
  primaryDisabled,
}: {
  primaryLabel: string;
  onPrimary: () => void;
  onBack?: () => void;
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-3 border-t border-border bg-bg p-4">
      {onBack ? <Button label={t("imports:backButton")} variant="ghost" onPress={onBack} /> : null}
      <View className="flex-1">
        <Button label={primaryLabel} onPress={onPrimary} loading={primaryLoading} disabled={primaryDisabled} />
      </View>
    </View>
  );
}
