import "@/lib/i18n";
import { StripeProvider } from "@stripe/stripe-react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { queryClient } from "@/api/query-client";
import { AuthProvider } from "@/contexts/auth-context";
import { env } from "@/env";
import { useThemeStore } from "@/stores/theme-store";
import { ThemeProvider } from "@/theme/theme-provider";

// Keep the native splash screen up until the persisted theme (mode + accent)
// has been read from secure-store. Called at module scope (not inside the
// component) per expo-splash-screen's guidance, so it registers before the
// first paint and doesn't race an already-hidden splash.
void SplashScreen.preventAutoHideAsync();

// Root layout: global providers (Stripe, Theme, React Query, Auth, i18n
// side-effect) + a headerless Stack over the route groups. `index` decides
// where to send the user based on auth.
export default function RootLayout() {
  const hasHydrated = useThemeStore((s) => s.hasHydrated);

  useEffect(() => {
    if (hasHydrated) void SplashScreen.hideAsync();
  }, [hasHydrated]);

  // Hold everything behind the splash screen until the theme store finishes
  // reading its persisted selection — otherwise we'd paint the default
  // mode/accent for a frame and then flash to the user's real preference.
  if (!hasHydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StripeProvider
        publishableKey={env.stripePublishableKey ?? ""}
        merchantIdentifier={env.stripeMerchantId}
        urlScheme={env.stripeUrlScheme}
      >
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
      </StripeProvider>
    </GestureHandlerRootView>
  );
}
