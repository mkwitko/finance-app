import { z } from "zod";

// Public runtime config. Expo inlines `EXPO_PUBLIC_*` at build time. Google client
// IDs are optional so the app runs via dev-login before OAuth is configured.
const EnvSchema = z.object({
  apiUrl: z.string().url(),
  googleWebClientId: z.string().optional(),
  googleIosClientId: z.string().optional(),
  stripePublishableKey: z.string().optional(),
});

export const env = EnvSchema.parse({
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000",
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
});
