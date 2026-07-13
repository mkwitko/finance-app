# DEPLOYMENT.md — Entrega com EAS (Build + Update + Submit)

> App mobile **não é estático servido por HTTP** — são **binários nativos** (`.ipa` / `.aab`/`.apk`) instalados via loja, mais um canal de **OTA** para atualizar o JS sem passar pela loja. Tudo isso é o **EAS** (Expo Application Services), na nuvem do Expo. **Sem Docker, sem Nginx, sem S3/CloudFront, sem CDK, sem CodePipeline.**
>
> Confira a doc versionada do Expo SDK 57 antes de configurar builds — https://docs.expo.dev/versions/v57.0.0/. EAS muda com frequência.

## 1. As três ferramentas EAS (e quando usar cada uma)

```
[eas build]   → compila o app nativo na nuvem     → .ipa (iOS) / .aab | .apk (Android)
                muda código NATIVO, deps nativas, permissões, SDK, ícone/splash
                        ↓
[eas submit]  → envia o binário para App Store / Play Store
                        ↓
[eas update]  → publica OTA só de JS/assets        → chega no device sem loja
                NÃO muda código nativo; só o bundle JS e os assets
```

| Ferramenta | O que faz | Precisa de review de loja? | Quando |
|---|---|---|---|
| **EAS Build** | Compila binário nativo na nuvem | — | Toda mudança de código nativo, dep nativa, SDK, permissão, ícone/splash, `app.json` nativo |
| **EAS Update** | Publica bundle JS + assets (OTA) | **Não** | Correção/feature **JS-only** — mesma runtime version de um build já instalado |
| **EAS Submit** | Sobe o binário para as lojas | Sim (loja) | Ao lançar/atualizar a versão nativa nas stores |

**Regra de ouro:** se a mudança é **só JS/TS/assets** e a **runtime version não mudou**, entregue por `eas update` (minutos, sem loja). Se tocou em **nativo** (nova lib nativa, permissão, bump de SDK, mudança de `runtimeVersion`), precisa de **novo build** + **submit**.

---

## 2. `eas.json` — perfis de build/update/submit

Três perfis canônicos: **development**, **preview**, **production**. Cada um casa um `build` com um `channel` de update.

```json
// eas.json
{
  "cli": {
    "version": ">= 12.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development",
      "env": {
        "APP_VARIANT": "development",
        "EXPO_PUBLIC_API_BASE_URL": "https://api.staging.finance-app.com"
      }
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "env": {
        "APP_VARIANT": "preview",
        "EXPO_PUBLIC_API_BASE_URL": "https://api.staging.finance-app.com"
      }
    },
    "production": {
      "autoIncrement": true,
      "channel": "production",
      "env": {
        "EXPO_PUBLIC_API_BASE_URL": "https://api.finance-app.com"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "deploy@finance-app.com",
        "ascAppId": "1234567890",
        "appleTeamId": "ABCDE12345"
      },
      "android": {
        "serviceAccountKeyPath": "./secrets/play-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

**Pontos importantes:**
- **`developmentClient: true`** no perfil `development` gera um **dev build** (ver §6) — não é o binário da loja.
- **`distribution: "internal"`** distribui por link/QR para testers (sem review de loja); `production` usa `store`.
- **`channel`** liga o build ao canal de OTA: um `eas update --branch <b>` mapeado para o `channel` chega nos builds daquele perfil.
- **`env`** define variáveis por perfil no **build** (ver §5). Elas **não** valem para `eas update` — updates precisam ler config do bundle já compilado.
- **`autoIncrement`/`appVersionSource: "remote"`** deixa o EAS gerenciar `buildNumber`/`versionCode`.

---

## 3. Runtime version — o contrato entre build e update

Um `eas update` **só** é entregue a um binário cuja **runtime version** bate. É o que impede empurrar JS incompatível com o nativo instalado.

```json
// app.json
{
  "expo": {
    "runtimeVersion": { "policy": "appVersion" },
    "updates": {
      "url": "https://u.expo.dev/<project-id>"
    }
  }
}
```

- **`policy: "appVersion"`** → a runtime version = a `version` do app (ex.: `1.4.0`). Mudou o nativo? Bump da `version` → novo build → só ele recebe os updates novos.
- Alternativas: `"sdkVersion"`, `"nativeVersion"`, ou uma string fixa manual.
- **Fluxo:** `eas update` calcula a runtime version do bundle e só serve para devices na mesma runtime. Mudança nativa **exige** bump + build + submit; JS-only pode reusar a runtime existente.

> Migração do lado do "classic updates"/`releaseChannel`: no modelo atual usa-se `channel` (no `eas.json`) + `branch` (no `eas update`). Um channel aponta para um branch; você promove branches entre channels sem rebuild.

---

## 4. Comandos essenciais

```bash
# Login (uma vez)
eas login

# --- BUILD (binário nativo na nuvem) ---
eas build --platform ios --profile development     # dev build p/ simulador/device
eas build --platform android --profile preview     # APK/AAB interno p/ testers
eas build --platform all --profile production       # build de loja (iOS + Android)

# --- UPDATE (OTA, só JS/assets) ---
eas update --branch preview --message "fix: label do card de usuário"
eas update --branch production --message "feat: filtro de bookings"

# Promover um branch testado para o channel de produção (sem rebuild)
eas channel:edit production --branch production

# --- SUBMIT (enviar às lojas) ---
eas submit --platform ios --profile production
eas submit --platform android --profile production

# Diagnóstico
eas build:list
eas update:list --branch production
eas env:list                      # variáveis de ambiente no EAS
```

**Ciclo típico de uma correção JS-only já em produção:**
```bash
pnpm typecheck && pnpm lint && pnpm test
eas update --branch production --message "fix: ..."
# chega nos apps no próximo cold start (ou conforme política de fetch)
```

**Ciclo de um release com mudança nativa:**
```bash
# bump da version em app.json (runtimeVersion policy = appVersion)
eas build --platform all --profile production
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

---

## 5. Env vars e secrets

Diferente da web (não há `VITE_*` inlinado num bundle estático servido por CDN). No Expo:

- **`EXPO_PUBLIC_*`** — expostas ao bundle JS (client). São **públicas** (vão para o app; não guarde segredo aqui). Definidas no `env` do perfil de build no `eas.json`, num `.env`, ou via `eas env`.
- **`extra` do `expo-constants`** — config lida em runtime via `Constants.expoConfig.extra`.

```ts
// app.config.ts  (ou o bloco "extra" do app.json)
export default {
  expo: {
    name: "finance-app",
    extra: {
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      env: process.env.APP_VARIANT ?? "development",
    },
  },
};
```

```ts
// src/env.ts — validação Zod do que veio do expo-constants
import Constants from "expo-constants";
import { z } from "zod";

const envSchema = z.object({
  apiBaseUrl: z.string().url(),
  googleWebClientId: z.string().min(1),
  googleIosClientId: z.string().min(1),
  env: z.enum(["development", "preview", "production"]).default("development"),
});

const parsed = envSchema.safeParse(Constants.expoConfig?.extra);
if (!parsed.success) {
  console.error("Env inválida:", parsed.error.flatten().fieldErrors);
  throw new Error("Configuração de ambiente inválida.");
}
export const env = parsed.data;
export type Env = typeof env;
```

**Secrets sensíveis** (chaves de assinatura, tokens de source map do Sentry, service account do Play) **nunca** vão para `EXPO_PUBLIC_*`. Guarde no **EAS** como variáveis sensíveis/secrets:

```bash
eas env:create --name SENTRY_AUTH_TOKEN --value "sntrys_..." --visibility secret --environment production
```

> **Env de build ≠ env de update.** O `env` do perfil vale no `eas build`. `eas update` não roda o build nativo, então config que muda entre ambientes precisa estar embutida via `extra`/`EXPO_PUBLIC_*` no momento do build, ou resolvida por `channel`.

---

## 6. Dev builds vs. Expo Go

- **Expo Go** — app "sandbox" da loja para prototipar. **Não** suporta libs nativas customizadas fora do SDK. Bom para começar; insuficiente para este projeto (`@react-native-google-signin/google-signin`, `@sentry/react-native`, Reanimated, `expo-secure-store`, etc. exigem um dev client).
- **Dev build** (`expo-dev-client`, perfil `development`) — um binário **seu** com o dev menu do Expo, capaz de rodar **qualquer** dep nativa e receber Metro/OTA. É o que o time usa no dia a dia.

```bash
pnpm add expo-dev-client
eas build --platform ios --profile development
# instala o dev build no device/simulador, depois:
pnpm start   # Metro serve o JS pro dev build
```

Regra: assim que o projeto tem qualquer dependência nativa fora do Expo Go (é o caso aqui), **use dev build**, não Expo Go.

---

## 7. Cross-repo: coordenação backend ↔ mobile

Backend e mobile são repos separados; mudança de schema breaking exige coordenação — **agravada no mobile** porque **versões antigas do app continuam instaladas** nos devices (nem todo mundo atualiza).

### 7.1 Mudança backward-compatible
1. PR no backend → deploy staging.
2. `eas update --branch preview` no mobile usando o campo novo (opcional) → testers validam.
3. Promove para produção (backend em prod; `eas update --branch production` ou novo build+submit se nativo).

### 7.2 Breaking change — **two-deploy pattern**
1. **Backend v1:** introduz campo novo opcional, mantém o antigo.
2. **Mobile:** passa a usar o campo novo (via `eas update` se JS-only).
3. **Backend v2:** remove o antigo **só depois** de a base instalada ter migrado.

**Cuidado extra mobile:** o backend precisa suportar **versões antigas do app por mais tempo** que a web — não há "forçar refresh". Use a runtime version e, se necessário, um **force-update gate** (checar versão mínima suportada no boot e bloquear a UI pedindo update na loja).

### 7.3 De onde vem o OpenAPI (Kubb)
Igual ao restante da stack: o Kubb lê a fixture commitada `api.json` (ver [`KUBB.md`](./KUBB.md)). Para regenerar contra o backend real, aponte `input.path` no `kubb.config.ts` para o `openapi.json` de staging. A geração roda **antes** do bundle (localmente / no CI antes do `eas build`), não dentro do EAS.

---

## 8. CI/CD

O gatilho de entrega roda `eas build`/`eas update` a partir do CI (ou `eas build --auto-submit` / **EAS Workflows**). Padrão recomendado:

```
[push na branch de release]
        ↓
[CI] pnpm install --frozen-lockfile
     pnpm api:generate          (Kubb — gera src/api/generated/)
     pnpm typecheck
     pnpm lint
     pnpm test                  (jest-expo)
        ↓
   JS-only?  →  eas update --branch <canal> --message "<sha>"
   nativo?   →  eas build --profile production --platform all --auto-submit
```

- **`eas update` no CI** para hotfix JS: chega em minutos, sem loja.
- **`eas build --auto-submit`** encadeia build + submit em um passo para releases nativos.
- **EAS Workflows** (YAML no repo) orquestra build→submit→update na nuvem do Expo, substituindo o CodePipeline da web.

---

## 9. Rollback

- **OTA (update):** reverta publicando de novo o bundle bom, ou reapontando o channel para um branch anterior — sem rebuild:
  ```bash
  eas update:list --branch production          # acha o update anterior estável
  eas update:republish --group <update-group-id>   # republica um update conhecido-bom
  # ou promover outro branch:
  eas channel:edit production --branch production-hotfix
  ```
- **Build/binário nativo:** não há "rollback" instantâneo na loja — a correção é um **novo build + submit**. Por isso a maioria dos problemas de produção JS-only se resolve por OTA, não por store.

---

## 10. Checklist de entrega

- [ ] `eas.json` com perfis `development` (dev client), `preview`, `production`
- [ ] Cada perfil de build tem `channel` ligado ao branch de OTA
- [ ] `runtimeVersion` policy definida em `app.json` (`appVersion`) + `updates.url`
- [ ] `EXPO_PUBLIC_*` só para config pública; segredos em `eas env` (visibility secret)
- [ ] `extra` do `expo-constants` validado com Zod em `src/env.ts`
- [ ] Dev build (`expo-dev-client`) em uso no time — não Expo Go
- [ ] Mudança JS-only → `eas update`; mudança nativa → `eas build` + `eas submit`
- [ ] Kubb (`pnpm api:generate`) roda no CI antes do build
- [ ] `typecheck` + `lint` + `test` verdes antes de `eas update`/`eas build`
- [ ] Backend mantém compat com versões antigas do app (base instalada)
- [ ] Plano de force-update para breaking changes que não dá pra resolver por OTA
- [ ] Source maps enviados ao Sentry no build (token em `eas env`, não no bundle)
