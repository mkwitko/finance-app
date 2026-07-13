# Docs — Expo Mobile Frontend (React Native + Expo Router)

Documentação de arquitetura de referência para os apps mobile **Expo / React Native** da empresa. Companheiro do backend Node+Fastify e do frontend web React.

> **Para começar, leia [`../SKILL.md`](../SKILL.md) primeiro.** É o documento mestre (entry point da skill) que Claude Code (e qualquer dev) deve carregar antes de qualquer task. Estes `.md` são as referências detalhadas, lidas sob demanda.
>
> **Expo mudou.** Este projeto usa **Expo SDK 57**. Confira a doc versionada em https://docs.expo.dev/versions/v57.0.0/ antes de escrever código que toque numa API do Expo.

---

## Índice

### Visão geral
- [`../SKILL.md`](../SKILL.md) — **Comece aqui.** Pilares, stack, estrutura de pastas, como Claude Code deve trabalhar.

### Arquitetura
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — Organização por módulo (não vertical slice), file-based routing com Expo Router, separação de camadas, RN component tree.
- [`CODING_STANDARDS.md`](./CODING_STANDARDS.md) — TypeScript strict, naming, imports, RN vs DOM, a11y, Definition of Done.

### Integração com o backend
- [`KUBB.md`](./KUBB.md) — Geração de types + TanStack Query hooks a partir do OpenAPI do backend Fastify.
- [`AUTH.md`](./AUTH.md) — JWT próprio + Google Sign-In (`@react-native-google-signin`): Google `idToken` → backend emite access/refresh JWT, tokens em `expo-secure-store`, `Authorization: Bearer`, refresh, `forceLogout`. Sem Cognito/Amplify, sem e-mail/senha.

### UI e interação
- [`STYLING.md`](./STYLING.md) — NativeWind v4 (Tailwind p/ RN), `className`, tokens, dark mode via `colorScheme`, primitivos em `components/ui/`, acessibilidade.
- [`FORMS.md`](./FORMS.md) — React Hook Form + Zod, integração com schemas Kubb, validação.
- [`STATE.md`](./STATE.md) — TanStack Query (server state) vs Zustand (UI state), patterns, optimistic updates.
- [`I18N.md`](./I18N.md) — react-i18next + expo-localization, namespaces por feature, formatação de números, mensagens Zod.
- [`DATES.md`](./DATES.md) — **leitura obrigatória.** Backend é UTC; app converte pro fuso do device. Armadilhas, input, testes determinísticos.
- [`UPLOADS.md`](./UPLOADS.md) — Presigned URL do S3, seleção via `expo-image-picker`/`expo-document-picker`, progress, cancel, retry.
- [`PERMISSIONS.md`](./PERMISSIONS.md) — **Autorização só por autenticação.** Este projeto **não** tem papéis/personas, `useCan`, `<Can>` nem catálogo de permissões. Backend restringe por posse do dado.

### Navegação e entrega
- [`NAVIGATION.md`](./NAVIGATION.md) — Expo Router (file-based), grupos `(auth)`/`(tabs)`, typed routes, params dinâmicos, deep link, guard de auth com `<Stack.Protected>`.
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — EAS Build (binários nativos) + EAS Update (OTA JS-only) + EAS Submit (lojas), perfis em `eas.json`, runtime version policy, env/secrets. **Sem Docker.**

### Qualidade
- [`TESTING.md`](./TESTING.md) — Jest + jest-expo + @testing-library/react-native + MSW (unit/integração); Maestro (`.maestro/*.yaml`) para E2E.
- [`PERFORMANCE.md`](./PERFORMANCE.md) — Startup, 60fps, listas (`FlatList`/`FlashList`), Reanimated na UI thread, JS bundle, `expo-image`.
- [`OBSERVABILITY.md`](./OBSERVABILITY.md) — Sentry (`@sentry/react-native`: crashes nativos + JS, replay), PostHog (`posthog-react-native`: analytics + feature flags), correlação com traceId do backend.

### Por que essas escolhas?
- [`DECISIONS.md`](./DECISIONS.md) — ADRs (Expo + Expo Router, NativeWind, JWT próprio + Google, Maestro, EAS, Jest/jest-expo, expo-secure-store, etc.).

> **Sem `DOCKER.md`.** A entrega mobile é 100% EAS — não há container. Se você veio do repo web, o antigo `DOCKER.md` não se aplica aqui.

---

## Stack — resumo

| Camada | Escolha |
|---|---|
| Framework | Expo SDK 57 (managed) |
| Runtime | React Native 0.86 + React 19 (Hermes, New Architecture) |
| Linguagem | TypeScript 5+ strict |
| Bundler | Metro |
| Router | Expo Router (file-based, typed routes) |
| Data fetching | TanStack Query 5 |
| API client | Kubb (gera types + hooks do OpenAPI) |
| UI/estilo | NativeWind v4 (Tailwind p/ RN) + primitivos em `components/ui/` |
| Auth | JWT próprio + Google Sign-In (`@react-native-google-signin`; tokens em expo-secure-store, Bearer) |
| Validation | Zod |
| Forms | React Hook Form + `@hookform/resolvers/zod` |
| UI state | Zustand (quando necessário) |
| Datas/timezone | date-fns + date-fns-tz + expo-localization |
| i18n | react-i18next (pt-BR ativo) |
| Erros + crashes | Sentry (`@sentry/react-native`) |
| Product analytics | PostHog (`posthog-react-native`) |
| Imagens | `expo-image` |
| Animação/gesto | Reanimated 4 + Gesture Handler |
| Testes unit/integr | Jest + jest-expo + @testing-library/react-native + MSW |
| Testes e2e | Maestro |
| Lint/Format | `expo lint` (ESLint flat config) |
| Package manager | pnpm |
| Build/Deploy | EAS Build + EAS Update + EAS Submit (**sem Docker**) |

---

## Performance targets (mobile)

| Métrica | Alvo | Limite |
|---|---|---|
| Cold start (TTI) | < 2s | 3.5s |
| Interações | 60fps (sem jank de lista) | — |
| Animações | na UI thread (Reanimated worklets) | — |
| JS bundle | enxuto; lazy nas telas pesadas | — |
| Crash-free sessions | > 99.5% | 99% |

Detalhes e checklist em [`PERFORMANCE.md`](./PERFORMANCE.md).

---

## Fluxo de leitura sugerido

**Se você nunca viu o projeto:**
1. `../SKILL.md` (~10 min)
2. `ARCHITECTURE.md` (~15 min)
3. `KUBB.md` para entender como consumir a API (~10 min)
4. `NAVIGATION.md` para entender o roteamento por arquivos e o guard de auth (~10 min)

**Se você vai adicionar uma tela/feature nova:**
1. `ARCHITECTURE.md` § Anatomia de um módulo + § Checklist
2. `NAVIGATION.md` para a rota (grupo, params, deep link)
3. `FORMS.md` se a feature tem formulário
4. `STATE.md` se precisa cachear dados ou mutations
5. `DATES.md` se a feature mexe com data/hora (obrigatório se sim)
6. `UPLOADS.md` se a feature recebe arquivos/foto do usuário
7. `PERMISSIONS.md` (curto) — lembrete de que não há autorização por papel; o gate é só autenticação
8. `I18N.md` se vai adicionar texto novo (sempre)
9. `OBSERVABILITY.md` § Eventos de produto (se a feature merece tracking)
10. `CODING_STANDARDS.md` § Definition of Done

**Se você está mexendo em estilo/UI:**
1. `STYLING.md`
2. `DECISIONS.md` § ADR NativeWind

**Se algo está lento / com jank:**
1. `PERFORMANCE.md`
2. Perfil de render + listas (`FlatList`/`FlashList`)

**Se algo está quebrando em produção:**
1. `OBSERVABILITY.md`
2. Sentry: filtre por release / environment / tag `trace_id` para correlacionar com o backend

**Se você vai fazer deploy:**
1. `DEPLOYMENT.md`
2. Confirme que as env vars de build estão no perfil EAS (incluindo `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_POSTHOG_KEY`) e que `SENTRY_AUTH_TOKEN` é um EAS Secret
