import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, View } from "react-native";
import { useCreateAccount, useListAccounts, useListTransactions } from "@/api/generated";
import { ScreenContainer } from "@/components/layout/screen-container";
import { TransactionRow } from "@/components/transactions/transaction-row";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useHouseholdStore } from "@/stores/household-store";

export default function TransactionsScreen() {
  const { t } = useTranslation();
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId);
  const enabled = Boolean(activeHouseholdId);

  const accounts = useListAccounts({ query: { enabled } });
  const txns = useListTransactions(undefined, { query: { enabled } });
  const createAccount = useCreateAccount();

  const firstAccount = accounts.data?.accounts?.[0];

  return (
    <ScreenContainer>
      <Text className="mt-2 text-2xl font-bold">{t("transactions:title")}</Text>

      {enabled && !firstAccount && (
        <Button
          className="mt-4"
          label="Criar conta"
          loading={createAccount.isPending}
          onPress={() =>
            createAccount.mutate(
              { data: { name: "Nubank", kind: "checking", currency: "BRL" } },
              { onSuccess: () => void accounts.refetch() },
            )
          }
        />
      )}

      {firstAccount && (
        <Button
          className="mt-4"
          label="Importar extrato"
          onPress={() => router.push("/import")}
        />
      )}

      <View className="mt-4 flex-1">
        {txns.isLoading ? (
          <ActivityIndicator />
        ) : (
          <FlatList
            data={txns.data?.transactions ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <TransactionRow txn={item} />}
            ListEmptyComponent={
              <Text className="text-neutral-500 dark:text-neutral-400">
                {t("transactions:empty")}
              </Text>
            }
          />
        )}
      </View>
    </ScreenContainer>
  );
}
