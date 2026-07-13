import { useEffect, useMemo } from "react";
import { View } from "react-native";
import { useColorScheme, vars } from "nativewind";
import { useThemeStore, type Mode } from "@/stores/theme-store";
import { tokenVars, type Accent, type Scheme } from "./theme-tokens";

export function useTheme() {
  const { mode, accent, setMode, setAccent } = useThemeStore();
  const { colorScheme } = useColorScheme();
  const scheme: Scheme =
    mode === "system" ? ((colorScheme ?? "light") as Scheme) : (mode as Scheme);
  return { mode, accent, scheme, setMode, setAccent };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { mode, accent, scheme } = useTheme();
  const { setColorScheme } = useColorScheme();

  useEffect(() => {
    setColorScheme(mode);
  }, [mode, setColorScheme]);

  const style = useMemo(() => vars(tokenVars(accent, scheme)), [accent, scheme]);

  return (
    <View style={[{ flex: 1 }, style]} className="bg-bg">
      {children}
    </View>
  );
}
