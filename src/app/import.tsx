import { router } from "expo-router";
import { ImportWizard } from "@/components/imports/import-wizard";

export default function ImportScreen() {
  return <ImportWizard onDone={() => router.replace("/(tabs)/transactions")} />;
}
