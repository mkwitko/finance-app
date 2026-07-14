import { Stack } from "expo-router";

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: "Ajustes", headerShown: false }} />
      <Stack.Screen name="plan" options={{ title: "Plano" }} />
      <Stack.Screen name="members" options={{ title: "Membros" }} />
      <Stack.Screen name="contexts" options={{ title: "Contextos" }} />
      <Stack.Screen name="theme" options={{ title: "Tema" }} />
    </Stack>
  );
}
