import { View } from "react-native";
import type { ListTransactionsQueryResponse } from "@/api/generated/types/ListTransactions";
import { Text } from "@/components/ui/text";
import { cn, formatCents } from "@/lib/utils";

type Transaction = ListTransactionsQueryResponse["transactions"][number];

export function TransactionRow({ txn }: { txn: Transaction }) {
  const isIn = txn.direction === "in";
  return (
    <View className="flex-row items-center justify-between border-b border-neutral-200 py-3 dark:border-neutral-800">
      <View className="flex-1 pr-3">
        <Text className="font-medium" numberOfLines={1}>
          {txn.description}
        </Text>
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">
          {txn.category ? `${txn.category.icon ?? "•"} ${txn.category.name}` : "Sem categoria"}
          {txn.aiCategorized ? "  · IA" : ""}
        </Text>
      </View>
      <Text
        className={cn(
          "font-semibold",
          isIn ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-900 dark:text-neutral-100",
        )}
      >
        {isIn ? "+" : "−"}
        {formatCents(txn.amountCents)}
      </Text>
    </View>
  );
}
