# DECISIONS.md — ADRs do app mobile

> Architecture Decision Records. Cada decisão técnica importante com **contexto**, **opções consideradas**, **decisão**, e **consequências**. Stack de referência: **Expo SDK 57 + React Native + Expo Router**. Ver a raiz [`../SKILL.md`](../SKILL.md).

---

## ADR-001 — Expo (managed) + Expo Router (em vez de bare React Native + React Navigation cru)

**Status:** Aceito · 2026

### Contexto
Precisamos de um app mobile React Native para um produto B2B **autenticado**, com foco em DX, type-safety end-to-end, entrega rápida (OTA) e paridade mental com o frontend web da empresa.

### Opções

1. **Expo managed + Expo Router** — toolchain Expo, roteamento file-based, EAS.
2. **Bare React Native + React Navigation** — controle total do nativo, config manual.
3. **Expo managed + React Navigation cru** — Expo sem o router file-based.

### Decisão
**Expo SDK 57 (managed) + Expo Router.**

### Por quê
- **Sem ejetar.** Config plugins + prebuild cobrem quase todo módulo nativo; EAS builda na nuvem.
- **OTA via EAS Update** — corrigir JS sem passar pela loja.
- **Expo Router = file-based + typed routes + deep link nativo** — mesma disciplina do TanStack Router file-based do web, adaptada ao runtime nativo. Guard de auth declarativo com `<Stack.Protected>`.
- **New Architecture default** no SDK 57; React Compiler disponível.
- **Menos boilerplate nativo.** Um dev de web produz tela mobile rápido.

### Trade-offs
- **Menos controle nativo** que bare RN. Módulo sem config plugin exige prebuild/patch — raro, mas acontece.
- **Amarra ao ciclo de release do Expo** (SDK novo a cada ~trimestre). Mitigado: upgrades são incrementais e bem documentados.
- **Expo Go não roda módulos nativos custom** — usamos **dev client** para testar auth/crash real.

### Quando reconsiderar
- Precisar de um módulo nativo pesado sem suporte Expo e sem viabilidade de config plugin → avaliar bare workflow (ainda dá pra manter Expo libs).

---

## ADR-002 — Kubb para gerar o API client a partir do OpenAPI (paridade com o web)

**Status:** Aceito · 2026

### Contexto
Backend Fastify expõe OpenAPI completo. Queremos type-safety end-to-end sem manter tipos em paralelo — igual ao frontend web.

### Opções

1. **Kubb** — gera types, Zod, hooks TanStack Query, client de fetch.
2. **openapi-typescript + hooks à mão.**
3. **orval** — similar, ecossistema menor.
4. **tRPC** — exigiria backend tRPC (não temos).

### Decisão
**Kubb** — mesma escolha do web.

### Por quê
- **Gera hooks TanStack Query prontos** (funcionam igual em RN).
- **Paridade com o web** — dev troca de repo sem reaprender o padrão de consumo de API.
- **Funciona com qualquer OpenAPI**; não exige lib específica no backend.

### Trade-offs
- **Build step extra.** Adiciona alguns segundos ao CI.
- **OpenAPI feio → código gerado feio.** Disciplina no backend (operationId, tags, schemas nomeados) é crítica.

### Quando reconsiderar
- Backend migra pra tRPC → adota client tRPC.

---

## ADR-003 — Zod no app (paridade com o web)

**Status:** Aceito · 2026

### Contexto
Precisamos validar forms, env vars e boundaries de deep link. O backend usa TypeBox.

### Decisão
**Zod no app** (TypeBox fica no backend).

### Por quê
- **`zodResolver` é a integração canônica** com React Hook Form.
- **Paridade com o web**, que já usa Zod.
- **Performance é irrelevante** no client (valida em submit/boot, não em hot path).

### Trade-offs
- **Duas linguagens de schema no ecossistema** (Zod no client, TypeBox no backend) — mas os repos não compartilham schema; Kubb gera os tipos do OpenAPI.

### Quando reconsiderar
- Monorepo verdadeiro com package compartilhado entre back e app.

---

## ADR-004 — NativeWind (em vez de StyleSheet puro / Tamagui / styled-components)

**Status:** Aceito · 2026

### Contexto
Precisamos de um sistema de estilo para RN com boa DX, dark mode fácil e, idealmente, paridade mental com o Tailwind do frontend web.

### Opções

1. **NativeWind v4** — Tailwind para RN; `className` nos componentes, resolvido em build.
2. **StyleSheet puro** (RN core) — sem dependência, mas verboso e sem design tokens compartilhados.
3. **Tamagui** — performático, compilador próprio, design system completo.
4. **styled-components / emotion** — CSS-in-JS runtime.

### Decisão
**NativeWind v4.**

### Por quê
- **Paridade com o web (Tailwind).** Mesma linguagem de utilitários; um dev de web estiliza tela mobile sem reaprender.
- **Build-time.** As classes viram estilos em build (via Babel/Metro) — sem custo de parse de CSS em runtime como CSS-in-JS.
- **Dark mode trivial** via `dark:` + `useColorScheme`.
- **Tokens num só lugar** (`tailwind.config.js`), reaproveitáveis.

### Trade-offs
- **Build-time only.** Classes totalmente dinâmicas (string montada em runtime) não funcionam como no web — use variantes/`cn()` com classes estáticas.
- **Mais uma camada** (Babel plugin + Metro) que pode quebrar em upgrade de SDK — fixamos versões e testamos no bump.
- **Menos "nativo"** que Tamagui em performance de estilo extrema; para o nosso caso (telas de CRUD B2B) é irrelevante.

### Quando reconsiderar
- App com necessidade de design system pesado + animações de layout intensas → avaliar Tamagui.

---

## ADR-005 — Maestro (em vez de Detox) para E2E

**Status:** Aceito · 2026

### Contexto
Testes end-to-end em simulador/emulador/device.

### Opções

1. **Maestro** — flows declarativos em YAML, auto-wait, tolerante a flakiness, recomendado pelo Expo.
2. **Detox** — gray-box, roda dentro do app, rápido, mas config e manutenção pesadas.
3. **Appium** — genérico, verboso, mais lento.

### Decisão
**Maestro.**

### Por quê
- **Simplicidade.** Flow é YAML legível (`launchApp`, `tapOn`, `assertVisible`); não precisa compilar código de teste.
- **Recomendado pelo Expo** — melhor caminho suportado para E2E em apps Expo.
- **Tolerância a flakiness** embutida (auto-wait sem `sleep`).
- **`maestro studio`** inspeciona a árvore de UI ao vivo — DX de descoberta ótima.

### Trade-offs
- **Mais lento que Detox** (black-box, sem hooks internos do app).
- **Menos controle fino** que Detox (não injeta mocks dentro do runtime tão facilmente) — mitigamos com o bypass `EXPO_PUBLIC_ENV=test` (ver [`TESTING.md`](./TESTING.md)).

### Quando reconsiderar
- Suíte E2E crescer muito e o tempo de execução virar gargalo → avaliar Detox para o caminho crítico.

---

## ADR-006 — React Hook Form (em vez de TanStack Form / Formik)

**Status:** Aceito · 2026

### Contexto
Library de form para validação tipada, performance e integração com Zod. Igual ao web.

### Decisão
**React Hook Form + `@hookform/resolvers/zod`.**

### Por quê
- **Padrão de mercado**, funciona em RN (com `Controller` para `TextInput` e componentes controlados).
- **Paridade com o web.**
- **Zod resolver canônico** — tipo do `data` no submit vem perfeito.

### Trade-offs
- **RN não tem uncontrolled inputs como o DOM** — campos costumam usar `Controller`, um pouco mais verboso.

### Quando reconsiderar
- TanStack Form amadurecer com integração RN de primeira linha.

---

## ADR-007 — EAS Build + Update + Submit (em vez de builds nativos manuais / Fastlane cru)

**Status:** Aceito · 2026

### Contexto
Precisamos gerar binários iOS/Android, entregar correções rápidas e submeter às lojas — sem manter máquina de build própria.

### Opções

1. **EAS (Build + Update + Submit)** — build na nuvem do Expo, OTA e submissão integrados.
2. **Xcode/Gradle local + Fastlane** — controle total, infra própria.
3. **CI genérico (GitHub Actions) rodando build nativo.**

### Decisão
**EAS Build + EAS Update + EAS Submit.** **Sem Docker.**

### Por quê
- **Build na nuvem** sem manter runner de macOS.
- **EAS Update = OTA** — corrige JS sem release de loja (respeitando runtime version).
- **EAS Submit** automatiza envio pra App Store / Play.
- **Integração 1ª classe com Expo managed** (config plugins, secrets, perfis em `eas.json`).

### Trade-offs
- **Dependência do serviço EAS** (custo por build acima do free tier).
- **OTA só cobre JS/assets** — mudança nativa exige novo binário.
- **Menos controle** que Fastlane cru sobre passos de build exóticos.

### Quando reconsiderar
- Volume de builds tornar o custo EAS proibitivo → self-host de build nativo.

Detalhes operacionais em [`DEPLOYMENT.md`](./DEPLOYMENT.md).

---

## ADR-008 — Jest + jest-expo (em vez de Vitest) para unit/integração

**Status:** Aceito · 2026

### Contexto
Test runner para unit/integração no runtime React Native.

### Opções

1. **Jest + `jest-expo`** — preset oficial do Expo, transforma módulos RN/Expo, mocks nativos prontos.
2. **Vitest** — mais rápido e ESM-first, mas sem suporte maduro ao runtime RN.

### Decisão
**Jest + `jest-expo`.**

### Por quê
- **`jest-expo` é o caminho suportado** — resolve transform de RN/Expo, ambiente e mocks nativos que o Vitest não cobre bem.
- **`@testing-library/react-native` assume Jest** (matchers, `act`).
- **Ecossistema RN inteiro** documenta com Jest.

### Trade-offs
- **Mais lento que Vitest** e config de `transformIgnorePatterns` chata (listar cada pacote ESM de node_modules).
- **Diverge do backend/web se eles usarem Vitest** — aceitável: o runtime é diferente.

### Quando reconsiderar
- Vitest ganhar suporte oficial e maduro ao runtime RN.

---

## ADR-009 — ESLint (via `expo lint`) para lint/format

**Status:** Aceito · 2026

### Contexto
Lint + organização de imports.

### Opções

1. **ESLint (flat config) via `expo lint`** — padrão do template Expo 57 (`eslint-config-expo`).
2. **Biome** — Rust, rápido, mas sem as regras específicas de RN/Expo.

### Decisão
**ESLint via `expo lint`** (`eslint-config-expo`).

### Por quê
- **É o padrão do template Expo SDK 57** — zero atrito, regras de RN/Expo já configuradas.
- **Regras específicas** (hooks, RN, import) que o Biome não cobre.
- **Um comando** (`pnpm lint` → `expo lint`) no fluxo e no CI.

### Trade-offs
- **Mais lento que Biome** em repos grandes (irrelevante no tamanho atual).
- **Config flat do ESLint** tem curva — mas herdamos de `eslint-config-expo`.

### Quando reconsiderar
- Repo crescer a ponto do lint virar gargalo de CI → avaliar Biome só para format.

---

## ADR-010 — `expo-secure-store` para tokens (em vez de AsyncStorage / memória)

**Status:** Aceito · 2026

### Contexto
Precisamos persistir o access/refresh JWT emitidos pelo backend entre execuções do app. No web usávamos cookies; no mobile não há cookies compartilháveis.

### Opções

1. **`expo-secure-store`** — Keychain (iOS) / Keystore (Android), criptografado pelo OS.
2. **AsyncStorage** — simples, mas texto plano no sandbox do app.
3. **Memória** — perde a sessão a cada cold start (UX ruim).
4. **SQLite criptografado** — overkill para chave-valor de tokens.

### Decisão
**`expo-secure-store`** guardando `accessToken` e `refreshToken` sob chaves fixas (`auth.accessToken`, `auth.refreshToken`).

### Por quê
- **Armazenamento seguro do OS** (Keychain/Keystore) — melhor proteção disponível no device.
- **Sobrevive a cold start** — sessão persiste sem novo login.
- **API simples** (`getItemAsync`/`setItemAsync`/`deleteItemAsync`) — só duas chaves para gerenciar.

### Trade-offs
- **API async** — leituras de token são `await` (encapsuladas em `lib/auth/tokens.ts`). Ver [`AUTH.md` §2.4](./AUTH.md#24-token-storage--expo-secure-store).
- **Limite de tamanho por item** (alguns KB) — suficiente para JWT.

### Quando reconsiderar
- Requisito de segurança elevar (ex.: exigir biometria por acesso) → SecureStore já suporta `requireAuthentication`.

---

## ADR-011 — react-i18next (paridade com o web) + expo-localization

**Status:** Aceito · 2026

### Contexto
App começa em pt-BR mas precisa suportar novos idiomas sem refatoração. Nenhuma string hardcoded. Precisamos detectar o locale do device.

### Decisão
**react-i18next** para strings + **expo-localization** para detectar locale/timezone do device.

### Por quê
- **Paridade com o web** (mesma lib, mesma estrutura de namespaces por feature).
- **`<Trans>`** para JSX interpolado.
- **`expo-localization`** dá locale e timezone do device (usado também em datas — ver [`DATES.md`](./DATES.md)).
- **`zod-i18n-map`** funciona out-of-the-box para mensagens de validação.

### Trade-offs
- **Mais verboso** que alternativas com macros (LinguiJS).
- **Bundle maior** — irrelevante no contexto mobile B2B.

### Quando reconsiderar
- Necessidade de gerenciamento colaborativo de traduções via SaaS.

---

## ADR-012 — `@sentry/react-native` para erros + crashes nativos

**Status:** Aceito · 2026

### Contexto
Precisamos saber quando o app quebra em produção, incluindo **crashes nativos** (iOS/Android), com contexto para diagnosticar sem reproduzir.

### Opções

1. **`@sentry/react-native`** — JS + crash nativo, replay mobile, source maps via EAS.
2. **Só JS (ex.: um logger caseiro)** — não captura crash nativo.
3. **Firebase Crashlytics** — forte em crash nativo, fraco em erro JS e sem replay.

### Decisão
**`@sentry/react-native`.**

### Por quê
- **Captura crash nativo E erro JS** num só lugar.
- **Source maps + símbolos de debug via EAS Build** (config plugin faz o upload).
- **`Sentry.wrap(RootLayout)`** + `expoRouterIntegration` instrumentam render e navegação.
- **Correlação com backend** via tag `trace_id`.

### Trade-offs
- **Custo escala com volume.**
- **Crash nativo não aparece no Expo Go** — validação exige dev client.
- **Peso do SDK nativo** no binário (aceitável).

### Quando reconsiderar
- Volume explodir → Sentry self-hosted / GlitchTip.

Setup em [`OBSERVABILITY.md`](./OBSERVABILITY.md).

---

## ADR-013 — `posthog-react-native` para product analytics + feature flags

**Status:** Aceito · 2026

### Contexto
Saber como usuários usam o app, fazer rollout gradual e medir adoção.

### Opções

1. **`posthog-react-native`** — eventos + flags + replay + funis, tudo-em-um.
2. **Mixpanel + LaunchDarkly + Hotjar** — best-of-breed por categoria.
3. **Firebase Analytics** — grátis, mas fraco em flags e replay.

### Decisão
**`posthog-react-native`.**

### Por quê
- **Tudo em um** — eventos + feature flags + funis + replay opcional.
- **Paridade conceitual com o web** (mesmo produto PostHog).
- **`<PostHogProvider autocapture>`** captura toques/telas sem instrumentar tudo à mão.
- **Feature flags com targeting** — rollout por %/grupo, com `useFeatureFlag`.
- **Custo previsível.**

### Trade-offs
- **Cada feature isolada** perde para a melhor da categoria — para B2B com poucos MAUs, cobre confortavelmente.
- **Replay sobrepõe com Sentry** — mantemos o do PostHog desligado por padrão.

### Quando reconsiderar
- Volume passar o plano ou surgir necessidade que o PostHog não cobre bem.

---

## ADR-014 — date-fns + date-fns-tz + expo-localization para datas

**Status:** Aceito · 2026

### Contexto
Backend manda ISO 8601 em UTC. O app exibe no fuso do device (detectado via expo-localization, com override possível) e processa input do usuário. Operações: comparar dias civis, somar dias, formatar intervalos.

### Opções

1. **`Date` nativo + `Intl`** — zero KB, mas verboso e sem helpers de manipulação; suporte a `Intl`/timezone no Hermes tem pegadinhas.
2. **date-fns + date-fns-tz** — funções puras, imutável, tree-shakeable.
3. **Day.js / Luxon** — APIs alternativas.

### Decisão
**date-fns + date-fns-tz** para manipulação; **expo-localization** para locale/timezone do device.

### Por quê
- **Funções puras nomeadas** (`addDays`, `isSameDay`, `formatInTimeZone`) — buscável, tree-shakeable.
- **Imutável** — impossível mutar `Date` sem querer.
- **`date-fns-tz` resolve fuso** em uma linha (DST correto), sem depender das pegadinhas de `Intl` no Hermes.
- **`expo-localization`** entrega o fuso/locale do device de forma confiável em RN.

### Trade-offs
- **Mais deps** — mitigado por tree-shaking.
- **API funcional** estranha pra quem vem de Moment.

### Quando reconsiderar
- Temporal estabilizar com suporte nativo no Hermes.

Detalhes em [`DATES.md`](./DATES.md).

---

## ADR-015 — Modais críticos como rota (Expo Router), efêmeros como state local

**Status:** Aceito · 2026

### Contexto
Detalhes de reserva/usuário aparecem como "tela sobreposta". Duas abordagens: modal controlado por `useState` vs modal como rota do Expo Router (`presentation: "modal"` / grupo de rota).

### Opções

1. **Tudo state local** — simples, mas sem deep link, o botão voltar do sistema fecha coisa errada, cold start perde o estado.
2. **Tudo rota** — cada interação vira boilerplate de rota.
3. **Híbrido (decisão)** — rota pro que importa, state pro que não.

### Decisão
**Vira rota quando** tem deep link que faz sentido (abrir reserva 123 via link/push notification), precisa sobreviver a reabertura do app, carrega dados pesados, ou é uma "tela" disfarçada (form/wizard). **Fica state local quando** é efêmero (confirm "tem certeza?"), sem identidade própria, reutilizável.

### Implementação — modal como rota

```tsx
// src/app/(tabs)/bookings/[id].tsx  — apresentado como modal
// no _layout do grupo:
<Stack.Screen name="[id]" options={{ presentation: "modal" }} />
```

Ou um grupo dedicado de rotas modais. Deep link (`financeapp://bookings/123`) abre direto; o botão voltar do sistema fecha o modal; reabrir o app com o link mantém o destino.

### Implementação — modal local

```tsx
const [confirmOpen, setConfirmOpen] = useState(false);
<Button onPress={() => setConfirmOpen(true)}>Excluir</Button>
<ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} onConfirm={handleDelete} />
```

### Regra prática
Se você ficaria irritado de **perder a tela ao reabrir o app ou ao receber um deep link**, é rota. Se "fechar e abrir de novo" é trivial, é state.

### Trade-offs
- **Rotas modais poluem a árvore** se abusadas — mantenha para o que tem identidade/deep link.

### Quando reconsiderar
- Precisar de stacks de modais aninhados (raro; costuma ser sinal de UX errada).

---

## ADR-016 — JWT próprio + Google Sign-In (em vez de Cognito/Amplify)

**Status:** Aceito · 2026 · _Substitui a decisão anterior de usar AWS Amplify + Cognito._

### Contexto
O app precisa autenticar usuários e falar com o backend Fastify próprio. A identidade é feita por **login com Google**; a sessão da API é um **JWT emitido pelo nosso backend**. Não há Cognito nem Amplify no projeto.

### Opções

1. **JWT próprio + Google Sign-In** — `@react-native-google-signin/google-signin` obtém um `idToken` do Google; o backend verifica e emite access/refresh JWT próprios.
2. **AWS Amplify v6 + Cognito** — cliente oficial Cognito (Hosted UI, refresh automático). Descartado: acopla a um provedor de identidade que não vamos usar e é pesado.
3. **`expo-auth-session` (Google, browser-based)** — OAuth genérico via web browser; troca de token mais na mão.

### Decisão
**JWT próprio + Google Sign-In** (`@react-native-google-signin/google-signin`). Tokens em `expo-secure-store`; `Authorization: Bearer`.

### Por quê
- **Backend é a autoridade** — ele valida o `idToken` do Google (audience/issuer), provisiona o usuário e assina o JWT. Uma única fonte de verdade de identidade.
- **`@react-native-google-signin` devolve o `idToken` direto** — caminho recomendado pelo Expo no SDK 57; sem montar o fluxo OAuth à mão.
- **Sem vendor de identidade** (Cognito) — menos superfície, menos dependência nativa pesada (Amplify RN).
- **JWT só de identidade** (`sub`/`email`/`name`) — este projeto não tem autorização por papel; o backend restringe por posse do dado (ver [`PERMISSIONS.md`](./PERMISSIONS.md)).

### Trade-offs
- **Nós é que mantemos o auth** — emissão, rotação e revogação de refresh token viram responsabilidade do backend (não há refresh automático de um SDK gerenciado).
- **`@react-native-google-signin` exige dev client** (config plugin nativo) — não roda no Expo Go.
- **Um provedor social hoje (Google)** — adicionar Apple/e-mail depois é trabalho novo no app **e** no backend.

### Quando reconsiderar
- Precisar de SSO corporativo/multi-IdP robusto → avaliar um provedor gerenciado (Cognito, Auth0) na frente do mesmo backend.

Setup em [`AUTH.md`](./AUTH.md). Contrato de endpoints (`/auth/google`, `/auth/refresh`, `/auth/logout`) implementado no backend Fastify.

---

## Como adicionar nova ADR

1. Próximo número sequencial.
2. Status: `Proposto` → `Aceito` (ou `Rejeitado`/`Substituído`).
3. Contexto: o problema, sem assumir conhecimento.
4. Opções: as **reais** consideradas — não strawmen.
5. Decisão + Por quê: link entre opção escolhida e critérios.
6. Trade-offs: o que você está perdendo.
7. Quando reconsiderar: gatilhos para revisitar.

**ADRs imutáveis.** Mudou a decisão? Crie nova ADR e marque a antiga `Substituído por ADR-XXX`.
