import "@/lib/i18n";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { queryClient } from "@/api/query-client";
import { AuthProvider } from "@/contexts/auth-context";
import { ThemeProvider } from "@/theme/theme-provider";

// Root layout: global providers (Theme, React Query, Auth, i18n side-effect) + a
// headerless Stack over the route groups. `index` decides where to send the user
// based on auth.
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
            </Stack>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
