import { Pressable, View } from "react-native";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme/theme-provider";
import { THEMES, type Accent } from "@/theme/theme-tokens";
import type { Mode } from "@/stores/theme-store";

const MODES: { value: Mode; label: string }[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
  { value: "system", label: "Sistema" },
];
const ACCENTS: { value: Accent; label: string }[] = [
  { value: "calm", label: "Calm" },
  { value: "bold", label: "Bold" },
  { value: "warm", label: "Warm" },
];

export function ThemePicker() {
  const { mode, accent, scheme, setMode, setAccent } = useTheme();
  return (
    <Card className="gap-5">
      <View className="gap-2">
        <Text variant="label">Modo</Text>
        <Segmented options={MODES} value={mode} onChange={setMode} />
      </View>
      <View className="gap-2">
        <Text variant="label">Acento</Text>
        <View className="flex-row gap-3">
          {ACCENTS.map((a) => {
            const selected = a.value === accent;
            return (
              <Pressable
                key={a.value}
                accessibilityRole="button"
                accessibilityLabel={`Acento ${a.label}`}
                accessibilityState={{ selected }}
                onPress={() => setAccent(a.value)}
                className={cn(
                  "flex-1 items-center gap-2 rounded-xl border-2 p-3",
                  selected ? "border-accent bg-bg-elevated" : "border-border",
                )}
              >
                <View
                  className="h-8 w-8 rounded-full"
                  style={{ backgroundColor: `rgb(${THEMES[a.value][scheme].accent})` }}
                />
                <Text className="text-xs font-semibold text-fg">{a.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Card>
  );
}
