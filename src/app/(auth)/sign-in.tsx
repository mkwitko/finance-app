import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, TextInput, View } from "react-native";
import { ScreenContainer } from "@/components/layout/screen-container";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { devLogin, isGoogleConfigured, signInWithGoogle } from "@/lib/auth";

export default function SignIn() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      Alert.alert(t("common:error"), (error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer className="justify-center">
      <Text className="text-3xl font-bold">{t("common:appName")}</Text>
      <Text className="mb-8 mt-1 text-neutral-500 dark:text-neutral-400">{t("auth:subtitle")}</Text>

      <Button
        label={isGoogleConfigured() ? t("auth:signInGoogle") : t("auth:googleNotConfigured")}
        loading={busy}
        disabled={!isGoogleConfigured()}
        onPress={() => void run(signInWithGoogle)}
      />

      {__DEV__ && (
        <View className="mt-10">
          <Text className="mb-2 text-sm text-neutral-500 dark:text-neutral-400">
            {t("auth:email")}
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t("auth:emailPlaceholder")}
            autoCapitalize="none"
            keyboardType="email-address"
            className="mb-3 min-h-[48px] rounded-2xl border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
          />
          <Button
            label={t("auth:devLogin")}
            variant="secondary"
            loading={busy}
            onPress={() => void run(() => devLogin(email.trim() || "dev@exemplo.com"))}
          />
        </View>
      )}
    </ScreenContainer>
  );
}
