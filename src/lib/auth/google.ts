import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { env } from "@/env";
import { loginWithGoogle } from "./session";

let configured = false;
function configureGoogle(): void {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: env.googleWebClientId,
    iosClientId: env.googleIosClientId,
  });
  configured = true;
}

/** Runs the native Google Sign-In flow, then exchanges the idToken for app tokens. */
export async function signInWithGoogle(): Promise<void> {
  if (!env.googleWebClientId) throw new Error("google_not_configured");
  configureGoogle();
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (response.type !== "success") throw new Error("google_cancelled");
  const idToken = response.data.idToken;
  if (!idToken) throw new Error("google_no_id_token");
  await loginWithGoogle(idToken);
}

export function isGoogleConfigured(): boolean {
  return Boolean(env.googleWebClientId);
}
