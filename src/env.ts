import { z } from "zod";

// Public runtime config. Expo inlines `EXPO_PUBLIC_*` at build time. Google client
// IDs are optional so the app runs via dev-login before OAuth is configured.
//
// `stripeMerchantId` / `stripeUrlScheme` fall back to the values already
// declared in app.json (the `@stripe/stripe-react-native` plugin config and
// `expo.scheme`). The merchant id is NOT a real Apple Merchant ID — it must be
// replaced (here and in app.json) with one provisioned in the Apple Developer
// portal before Apple Pay will work. Card payments via PaymentSheet work fine
// without it.
const EnvSchema = z.object({
  apiUrl: z.string().url(),
  googleWebClientId: z.string().optional(),
  googleIosClientId: z.string().optional(),
  stripePublishableKey: z.string().optional(),
  stripeMerchantId: z.string(),
  stripeUrlScheme: z.string(),
});

export const env = EnvSchema.parse({
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000",
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  stripeMerchantId: process.env.EXPO_PUBLIC_STRIPE_MERCHANT_ID ?? "merchant.com.financeapp",
  stripeUrlScheme: process.env.EXPO_PUBLIC_STRIPE_URL_SCHEME ?? "financeapp",
});
