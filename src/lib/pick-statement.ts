import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";

// Opens the system document picker for a statement file (.ofx/.csv) and reads its
// text. Returns null if the user cancels. `copyToCacheDirectory` gives a local URI
// the File API can read immediately.
export async function pickStatement(): Promise<{ name: string; content: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    type: ["application/x-ofx", "text/csv", "text/comma-separated-values", "text/plain", "*/*"],
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const content = await new File(asset.uri).text();
  return { name: asset.name, content };
}
