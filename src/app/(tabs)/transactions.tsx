import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, TextInput, View } from "react-native";
import {
  useCreateAccount,
  useCreateImport,
  useListAccounts,
  useListTransactions,
} from "@/api/generated";
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
  const createImport = useCreateImport();
  const [content, setContent] = useState("");

  const firstAccount = accounts.data?.accounts?.[0];

  const onImport = () => {
    if (!firstAccount || content.trim().length === 0) return;
    const source: "ofx" | "csv" = content.includes("STMTTRN") ? "ofx" : "csv";
    createImport.mutate(
      { data: { source, accountId: firstAccount.id, content } },
      {
        onSuccess: () => {
          setContent("");
          void txns.refetch();
        },
      },
    );
  };

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
        <View className="mt-4">
          <TextInput
            value={content}
            onChangeText={setContent}
            multiline
            placeholder={t("transactions:importTitle")}
            className="h-24 rounded-2xl border border-neutral-300 p-3 text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
          />
          <Button
            className="mt-2"
            label={t("transactions:importRun")}
            loading={createImport.isPending}
            onPress={onImport}
          />
        </View>
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
