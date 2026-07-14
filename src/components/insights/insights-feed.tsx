import { RefreshControl, ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useGetInsights, useRefreshInsights } from "@/api/generated";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { InsightCard } from "@/components/insights/insight-card";
import { useHouseholdStore } from "@/stores/household-store";

export function InsightsFeed() {
  const { t } = useTranslation();
  const householdId = useHouseholdStore((s) => s.activeHouseholdId);
  const { data, isLoading, isError, refetch } = useGetInsights(householdId ?? undefined, {
    query: { enabled: Boolean(householdId) },
  });
  const refresh = useRefreshInsights();

  const onRefresh = () => {
    if (!householdId) return;
    refresh.mutate({ id: householdId }, { onSettled: () => refetch() });
  };

  const insights = data?.insights ?? [];
  const refreshControl = <RefreshControl refreshing={refresh.isPending} onRefresh={onRefresh} />;

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between p-5">
        <Text variant="title">{t("insights:title")}</Text>
        <Button
          label={t("insights:refreshButton")}
          variant="secondary"
          size="sm"
          onPress={onRefresh}
          loading={refresh.isPending}
          disabled={!householdId || refresh.isPending}
        />
      </View>
      {isLoading ? (
        <View className="gap-3 px-5">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </View>
      ) : isError ? (
        <ScrollView testID="insights-scroll" contentContainerClassName="flex-grow" refreshControl={refreshControl}>
          <EmptyState
            title={t("insights:errorTitle")}
            message={t("insights:errorMessage")}
            actionLabel={t("insights:retryButton")}
            onAction={() => refetch()}
          />
        </ScrollView>
      ) : insights.length === 0 ? (
        <ScrollView testID="insights-scroll" contentContainerClassName="flex-grow" refreshControl={refreshControl}>
          {householdId ? (
            <EmptyState
              title={t("insights:emptyTitle")}
              message={t("insights:emptyMessage")}
            />
          ) : (
            <EmptyState
              title={t("insights:noHouseholdTitle")}
              message={t("insights:noHouseholdMessage")}
            />
          )}
        </ScrollView>
      ) : (
        <ScrollView
          testID="insights-scroll"
          className="px-5"
          contentContainerClassName="gap-3 pb-8"
          refreshControl={refreshControl}
        >
          {insights.map((it) => (
            <InsightCard key={it.id} insight={it} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
