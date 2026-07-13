import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useCommitImport, useListAccounts, useListCategories, usePreviewImport } from "@/api/generated";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { Segmented } from "@/components/ui/segmented";
import { Text } from "@/components/ui/text";
import { BANK_GUIDES, getBankGuide } from "@/constants/bank-import-guides";
import { contextErrorMessage } from "@/lib/context-errors";
import { pickStatement } from "@/lib/pick-statement";
import { CategoryPickerSheet } from "./category-picker-sheet";
import { ReviewRow } from "./review-row";
import { WizardFooter } from "./wizard-footer";

type Step = "account" | "source" | "file" | "review" | "result";
type Source = "ofx" | "csv";
type PreviewRow = {
  amountCents: number; direction: "in" | "out"; occurredAt: string; description: string;
  rawRef: string | null; suggestedCategory: string | null; confidence: number; duplicate: boolean;
};
type Edit = { included: boolean; categoryName: string | null };

const SOURCES: { value: Source; label: string }[] = [
  { value: "ofx", label: "OFX" },
  { value: "csv", label: "CSV" },
];

export function ImportWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>("account");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [bankId, setBankId] = useState("nubank");
  const [source, setSource] = useState<Source>("ofx");
  const [file, setFile] = useState<{ name: string; content: string } | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [edits, setEdits] = useState<Edit[]>([]);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [pickingCategory, setPickingCategory] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const accounts = useListAccounts().data?.accounts ?? [];
  const categories = useListCategories().data?.categories ?? [];
  const preview = usePreviewImport();
  const commit = useCommitImport();
  const guide = getBankGuide(bankId);
  const includedCount = edits.filter((e) => e.included).length;

  const reset = () => {
    setStep("account");
    setAccountId(null);
    setBankId("nubank");
    setSource("ofx");
    setFile(null);
    setRows([]);
    setEdits([]);
    setResult(null);
    setPickingCategory(null);
    setError(null);
  };

  const pick = async () => {
    setPicking(true);
    try {
      const picked = await pickStatement();
      if (picked) {
        setFile(picked);
        setStep("file");
      }
    } finally {
      setPicking(false);
    }
  };

  const analyze = () => {
    if (!accountId || !file) return;
    setError(null);
    preview.mutate(
      { data: { source, accountId, content: file.content } },
      {
        onSuccess: (res: { rows: PreviewRow[] }) => {
          setRows(res.rows);
          setEdits(res.rows.map((r) => ({ included: !r.duplicate, categoryName: r.suggestedCategory })));
          setStep("review");
        },
        onError: (e: unknown) => setError(contextErrorMessage(e)),
      },
    );
  };

  const doCommit = () => {
    if (!accountId) return;
    setError(null);
    const payloadRows = rows
      .map((r, i) => ({ r, e: edits[i] }))
      .filter(({ e }) => e.included)
      .map(({ r, e }) => ({
        amountCents: r.amountCents, direction: r.direction, occurredAt: r.occurredAt,
        description: r.description, rawRef: r.rawRef, categoryName: e.categoryName,
      }));
    commit.mutate(
      { data: { accountId, source, rows: payloadRows } },
      {
        onSuccess: (res: { imported: number; skipped: number }) => { setResult(res); setStep("result"); },
        onError: (e: unknown) => setError(contextErrorMessage(e)),
      },
    );
  };

  return (
    <View className="flex-1 bg-bg">
      <ScrollView className="flex-1 p-5" contentContainerStyle={{ gap: 12 }}>
        {step === "account" && (
          <View className="gap-2">
            <Text variant="title">Qual conta?</Text>
            {accounts.map((a) => (
              <ListRow
                key={a.id}
                title={a.name}
                subtitle={a.kind}
                leading={<Badge label={a.id === accountId ? "✓" : "·"} tone={a.id === accountId ? "income" : "neutral"} />}
                onPress={() => setAccountId(a.id)}
              />
            ))}
          </View>
        )}
        {step === "source" && (
          <View className="gap-3">
            <Text variant="title">Como baixar seu extrato</Text>
            <Segmented options={SOURCES} value={source} onChange={setSource} />
            <View className="gap-2">
              <Text variant="label">Seu banco</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
                {BANK_GUIDES.map((g) => {
                  const selected = g.id === bankId;
                  return (
                    <Pressable
                      key={g.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setBankId(g.id)}
                      className={cn(
                        "flex-row items-center gap-1.5 rounded-full border px-3 py-2",
                        selected ? "border-accent bg-bg-elevated" : "border-border",
                      )}
                    >
                      <Text className="text-sm">{g.emoji}</Text>
                      <Text className={cn("text-sm font-semibold", selected ? "text-accent" : "text-fg-secondary")}>{g.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <Card className="gap-2">
              <Text variant="label">{guide.emoji} {guide.label} → {source.toUpperCase()}</Text>
              {(source === "ofx" ? guide.ofxSteps : guide.csvSteps).map((s, i) => (
                <Text key={i} className="text-fg-secondary">{i + 1}. {s}</Text>
              ))}
            </Card>
          </View>
        )}
        {step === "file" && (
          <View className="gap-3">
            <Text variant="title">Arquivo</Text>
            {file ? (
              <ListRow title={file.name} subtitle="selecionado" />
            ) : (
              <Text className="text-fg-secondary">Nenhum arquivo</Text>
            )}
            <Text className="text-accent" onPress={pick}>Escolher outro arquivo</Text>
          </View>
        )}
        {step === "review" && (
          <View>
            <Text variant="title" className="mb-2">Revisar · {rows.length} encontradas</Text>
            {rows.map((r, i) => (
              <ReviewRow
                key={`${r.rawRef ?? "n"}-${i}`}
                row={r}
                included={edits[i]?.included ?? false}
                onToggle={() => setEdits((prev) => prev.map((e, j) => (j === i ? { ...e, included: !e.included } : e)))}
                onEditCategory={() => setPickingCategory(i)}
              />
            ))}
          </View>
        )}
        {step === "result" && result && (
          <View className="items-center gap-2 py-8">
            <Text variant="display" className="text-income">{result.imported}</Text>
            <Text className="text-fg-secondary">{result.imported} importada(s)</Text>
            {result.skipped > 0 ? <Text className="text-fg-secondary">{result.skipped} pulada(s)</Text> : null}
            <Text className="text-accent mt-4" onPress={reset}>Importar outro</Text>
          </View>
        )}
      </ScrollView>

      {error ? <Text className="px-5 pb-2 text-expense">{error}</Text> : null}

      {step === "account" && (
        <WizardFooter primaryLabel="Continuar" primaryDisabled={!accountId} onPrimary={() => setStep("source")} />
      )}
      {step === "source" && (
        <WizardFooter
          primaryLabel="Escolher arquivo"
          primaryLoading={picking}
          onBack={() => setStep("account")}
          onPrimary={pick}
        />
      )}
      {step === "file" && (
        <WizardFooter
          primaryLabel="Analisar extrato"
          primaryLoading={preview.isPending}
          primaryDisabled={!file}
          onBack={() => setStep("source")}
          onPrimary={analyze}
        />
      )}
      {step === "review" && (
        <WizardFooter
          primaryLabel={`Importar ${includedCount}`}
          primaryLoading={commit.isPending}
          primaryDisabled={includedCount === 0}
          onBack={() => setStep("file")}
          onPrimary={doCommit}
        />
      )}
      {step === "result" && <WizardFooter primaryLabel="Ver transações" onPrimary={onDone} />}

      <CategoryPickerSheet
        visible={pickingCategory !== null}
        categories={categories}
        onPick={(name) => {
          setEdits((prev) => prev.map((e, j) => (j === pickingCategory ? { ...e, categoryName: name } : e)));
          setPickingCategory(null);
        }}
        onClose={() => setPickingCategory(null)}
      />
    </View>
  );
}
