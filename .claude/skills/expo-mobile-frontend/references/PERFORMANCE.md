# PERFORMANCE.md — Performance no React Native

> No mobile o usuário sente performance em **três coisas**: o quão rápido o app **abre** (startup), se as interações rodam a **60fps** (sem jank), e quanto uma ação demora pra **responder** ao toque. Não há LCP/INP/CLS (isso é web). O modelo mental é **duas threads**: a **JS thread** (sua lógica React) e a **UI thread** (renderização/gestos nativos). Manter as duas livres é o jogo inteiro.
>
> Confira a doc versionada do Expo SDK 57 antes de otimizar APIs nativas — https://docs.expo.dev/versions/v57.0.0/.

---

## 1. O que medir (não há Core Web Vitals aqui)

| Sinal | O que é | Como observar |
|---|---|---|
| **TTI / startup** | Tempo do toque no ícone até a UI interativa | Perf monitor do dev menu; Sentry mobile (app start span); traces nativos |
| **JS thread FPS** | Frames que a lógica React consegue produzir | Perf monitor (overlay de FPS); Flipper/DevTools |
| **UI thread FPS** | Frames que o nativo renderiza (scroll, gesto, animação) | Perf monitor (linha separada de FPS UI) |
| **Tempo de interação** | Toque → feedback visível | React DevTools Profiler; medição manual em spans |
| **Uso de memória** | Vazamentos, imagens grandes retidas | Xcode Instruments / Android Studio Profiler |

**Regra prática:** as duas linhas de FPS no perf monitor devem ficar coladas em 60 (ou 120 em telas ProMotion) durante scroll e animação. Queda na **UI thread FPS** = animação/render pesado; queda na **JS thread FPS** = lógica bloqueando o JS.

> **Sem números inventados de SLO.** Meça no device real (não simulador — simulador engana startup e FPS). Estabeleça baseline por device-alvo e trate regressão relativa, não um alvo absoluto copiado da web.

---

## 2. Startup — abrir rápido

### 2.1 Hermes (engine padrão)

O Expo SDK 57 usa **Hermes** por padrão. Hermes compila o JS para **bytecode** em build, então o app não parseia JS grande no cold start — startup mais rápido e menos memória. Não desabilite Hermes sem motivo forte.

### 2.2 New Architecture / JSI

O SDK 57 tem a **New Architecture** ligada por padrão. Ela troca a "bridge" assíncrona antiga por **JSI** (chamada direta JS↔nativo), reduzindo o *bridge chatter* — o custo de serializar mensagens indo e voltando. Menos travessias = menos jank. Escreva código que **não** dependa do batching da bridge legada.

### 2.3 Enxugar o trabalho de boot

- **Lazy nas telas pesadas** — não importe telas raras no bundle inicial (ver §5).
- **Adie trabalho não-crítico** para depois da primeira interação com `InteractionManager` (ver §6).
- **Splash screen** controlado (`expo-splash-screen`): esconda **só** quando os dados/fontes essenciais carregaram — evita flash de tela vazia, sem prender o usuário.

---

## 3. Listas — a causa nº 1 de jank

**Nunca** renderize listas longas com `.map()` dentro de `<ScrollView>` — isso monta **todos** os itens de uma vez, estoura memória e trava o scroll.

Use virtualização: `FlatList` (RN core) ou `FlashList` (Shopify, mais rápido para listas grandes/complexas):

```tsx
import { FlatList } from "react-native";
import { UserRow } from "@/components/users/user-row";

function UsersList({ users }: { users: User[] }) {
  return (
    <FlatList
      data={users}
      keyExtractor={(u) => u.id}
      renderItem={({ item }) => <UserRow user={item} />}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={5}
      removeClippedSubviews
    />
  );
}
```

**`FlashList`** (drop-in mais performático) precisa de uma dica de tamanho:

```tsx
import { FlashList } from "@shopify/flash-list";

<FlashList
  data={bookings}
  keyExtractor={(b) => b.id}
  renderItem={({ item }) => <BookingCard booking={item} />}
  estimatedItemSize={88}
/>;
```

**Regras de lista:**
- `keyExtractor` estável (id, nunca índice).
- **Item memoizado** (`React.memo`) — senão scroll re-renderiza tudo.
- `renderItem` referencialmente estável (defina fora ou com `useCallback`).
- Evite funções/objetos inline nas props do item (quebram o `memo`).
- `getItemLayout` no `FlatList` quando a altura é fixa (pula medição).

---

## 4. Re-render — cortar trabalho no JS thread

### 4.1 React Compiler já ajuda

O SDK 57 roda com **React Compiler** ligado (`experiments.reactCompiler` — ver [`../SKILL.md`](../SKILL.md) §2). Ele memoiza automaticamente muito do que antes exigia `useMemo`/`useCallback` manual. **Não** encha o código de memoização defensiva "por via das dúvidas" — deixe o compiler trabalhar e otimize pontos medidos.

### 4.2 Quando ainda memoizar à mão

- **`React.memo`** em itens de lista e componentes caros que recebem props estáveis.
- **`useMemo`** para cálculos realmente caros (transformar/ordenar listas grandes).
- **Referências estáveis** para props que alimentam componentes memoizados (o compiler cobre boa parte, mas fronteiras com libs de terceiros às vezes precisam de ajuda).

```tsx
const UserRow = React.memo(function UserRow({ user }: { user: User }) {
  return (
    <View className="flex-row items-center gap-3 p-4">
      <Text className="text-foreground">{user.name}</Text>
    </View>
  );
});
```

**Não memoize tudo.** `memo` só compensa se comparar props for mais barato que re-renderizar. Em componentes triviais, é overhead.

---

## 5. Lazy load de telas/componentes pesados

Telas raras ou componentes pesados (gráficos, mapas, editores) não precisam entrar no bundle do boot:

```tsx
import { lazy, Suspense } from "react";
import { ActivityIndicator, View } from "react-native";

const HeavyChart = lazy(() => import("@/components/dashboard/heavy-chart"));

function Dashboard() {
  return (
    <Suspense fallback={<View className="h-96 items-center justify-center"><ActivityIndicator /></View>}>
      <HeavyChart />
    </Suspense>
  );
}
```

**Candidatos:** libs grandes (charts, mapas, PDF, câmera avançada), telas raramente abertas, modais complexos sob demanda. O Expo Router já separa telas por arquivo; o `lazy` cobre componentes internos pesados.

---

## 6. Animação e gesto — na UI thread

O jank de animação vem de rodar a animação na **JS thread**: se o JS trava, a animação engasga. Solução: **Reanimated** com **worklets**, que executam **na UI thread** — a animação continua fluida mesmo com o JS ocupado.

```tsx
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";

function FadeInCard() {
  const opacity = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  // dispara a animação; o cálculo de cada frame roda na UI thread (worklet)
  opacity.value = withTiming(1, { duration: 200 });

  return <Animated.View style={style} className="rounded-lg bg-card p-4" />;
}
```

- Prefira **Reanimated 4** ao `Animated` do RN core em hot paths (o `Animated` core roda parte na JS thread).
- Gestos com **Gesture Handler** (também na UI thread).
- **`InteractionManager`** para adiar trabalho pesado **até depois** de uma transição/animação terminar — a navegação anima suave e o fetch/parse acontece depois:

```tsx
import { InteractionManager } from "react-native";

useEffect(() => {
  const task = InteractionManager.runAfterInteractions(() => {
    // trabalho pesado que pode esperar a transição de tela acabar
    prefetchHeavyData();
  });
  return () => task.cancel();
}, []);
```

---

## 7. Imagens

Sempre **`expo-image`** (nunca `<Image>` cru do RN — ver [`STYLING.md`](./STYLING.md) §13):

```tsx
import { Image } from "expo-image";

<Image
  source={uri}
  placeholder={{ blurhash }}
  contentFit="cover"
  cachePolicy="memory-disk"
  transition={200}
  className="h-40 w-full rounded-lg"
/>;
```

- **Cache** memória+disco embutido — evita rebaixar a mesma imagem e reduz jank de scroll.
- **`blurhash`** como placeholder — sem "pulo" e sem tela cinza enquanto carrega.
- **Dimensione no servidor/CDN** — não baixe uma imagem 4000px para exibir num avatar de 64pt (memória e decode custam caro).

---

## 8. Evitar bridge chatter e trabalho no JS thread

- **Sem cálculo pesado em handler de toque** — adie (`InteractionManager`) ou mova para worklet.
- **Sem `JSON.parse` de payload gigante** em cima de uma interação — a New Architecture (JSI) reduz o custo de travessia, mas parsear 1MB ainda bloqueia o JS thread.
- **Debounce** em inputs de busca (300–500ms).
- **Throttle** em handlers de scroll/gesto que disparam no JS.
- **Minimize props que atravessam** para muitos componentes nativos por frame (cada mudança de prop é trabalho).

---

## 9. Data fetching — TanStack Query

- **`staleTime` apropriado** evita refetch desnecessário a cada foco de tela.
- **`select`** para derivar/reduzir o payload no cache sem re-render extra.
- **Prefetch** de dados da próxima tela na transição (com `InteractionManager` para não competir com a animação).
- Ver [`STATE.md`](./STATE.md) para os padrões de cache/invalidação.

---

## 10. Profiling em dev

### 10.1 Perf monitor (dev menu)

Abra o dev menu no dev build → **Show Perf Monitor**. Mostra **duas** linhas de FPS (JS e UI), uso de RAM e views. Faça a interação lenta e observe **qual** thread cai.

### 10.2 React DevTools Profiler

Grave a interação lenta e veja o flamegraph de renders — identifica cascata de re-render e componentes caros. Cuidado: profiling em dev é mais lento que produção; para números finos use um **release build**.

### 10.3 Ferramentas nativas

- **Xcode Instruments** (iOS) — CPU, memória, time profiler.
- **Android Studio Profiler** — memória, jank de frames.
- **Sentry mobile** — spans de app start e traces nativos em produção (ver [`OBSERVABILITY.md`](./OBSERVABILITY.md)).

### 10.4 Detectar re-render excessivo

```tsx
import { useEffect, useRef } from "react";

export function useTraceUpdate(props: Record<string, unknown>) {
  const prev = useRef(props);
  useEffect(() => {
    const changed: Record<string, unknown> = {};
    for (const k of Object.keys(props)) {
      if (prev.current[k] !== props[k]) changed[k] = { from: prev.current[k], to: props[k] };
    }
    if (Object.keys(changed).length) console.log("changed:", changed);
    prev.current = props;
  });
}
```

Use só em dev; remova antes do PR (sem `console.log` em produção — [`OBSERVABILITY.md`](./OBSERVABILITY.md)).

---

## 11. Checklist de performance

Antes de mergear feature pesada (**meça em device real, não simulador**):

- [ ] Listas usam `FlatList`/`FlashList` com `keyExtractor` estável — nunca `.map()` em `ScrollView`
- [ ] Itens de lista memoizados; `renderItem`/props estáveis
- [ ] Perf monitor: JS **e** UI thread perto de 60fps durante scroll/animação
- [ ] Animação/gesto em worklets (Reanimated/Gesture Handler), não `Animated` core em hot path
- [ ] Trabalho pesado adiado com `InteractionManager` após transições
- [ ] Telas/componentes pesados em `lazy` + `Suspense`
- [ ] `expo-image` com cache + blurhash; imagens dimensionadas na origem
- [ ] Sem `JSON.parse`/cálculo pesado bloqueando o JS thread num toque
- [ ] TanStack Query com `staleTime` apropriado; sem refetch redundante
- [ ] React Compiler ligado; memoização manual só onde medida
- [ ] Startup verificado em cold start (device real), splash escondido só quando pronto
- [ ] React DevTools Profiler — sem cascata de re-renders
