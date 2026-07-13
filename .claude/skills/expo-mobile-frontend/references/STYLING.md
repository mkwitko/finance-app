# STYLING.md — NativeWind v4 (Tailwind para React Native)

> **NativeWind** traz o modelo mental do Tailwind para o React Native: você escreve `className` em componentes RN (`View`, `Text`, `Pressable`) e um plugin de Babel + Metro converte isso em estilos nativos em build. Não é CSS no runtime — não há DOM, não há cascata. É a mesma "parity mental" do front web da empresa, adaptada ao runtime nativo.
>
> **Diferença central vs. o front web (Tailwind v4 CSS-first):** no mobile **existe** um `tailwind.config.js` de verdade. Não usamos `@theme` no CSS, nem a detecção automática de conteúdo da v4 web. NativeWind exige o preset (`nativewind/preset`), o `content` explícito e os tokens de tema em `theme.extend` do config. Veja [`../SKILL.md`](../SKILL.md) §2 para o porquê de NativeWind (não StyleSheet puro / Tamagui) e [`DECISIONS.md`](./DECISIONS.md).

---

## 1. Como NativeWind funciona (diferente do Tailwind web)

**Tailwind web:** classes viram CSS, o browser aplica a cascata em runtime.

**NativeWind:** `className` é lido em **build** (Babel `jsxImportSource: "nativewind"` + `withNativeWind` no Metro) e transformado nos props de estilo nativos que o React Native entende (`StyleSheet`). O RN não tem DOM nem cascata — cada componente recebe seu estilo resolvido.

**Consequências práticas:**
- Você estiliza **primitivos RN** (`View`/`Text`/`Pressable`/`ScrollView`/`FlatList`), nunca `div`/`span`/`button`.
- Nem toda utility web existe (não há `hover:` em touch, sem pseudo-elementos, sem grid completo). Layout é **flexbox** (o RN já é `display: flex` por padrão, `flexDirection: column`).
- Estados como `active:`/`focus:` funcionam; `dark:` funciona via `colorScheme`.
- `className` só funciona em componentes com suporte a NativeWind (os core do RN já vêm mapeados; componentes de terceiros podem precisar de `cssInterop`).

**Vantagens:**
- Uma linguagem de estilo entre web e mobile — dev do time troca de repo sem reaprender.
- Sem `StyleSheet.create` verboso espalhado; estilo fica junto da marcação.
- Dark mode e tema centralizados em um `tailwind.config.js`.

**Trade-off:**
- Componentes de terceiros que não são RN-core podem exigir `cssInterop`/`remapProps`.
- Animação e hot paths de performance ainda pedem `StyleSheet`/Reanimated (ver [`PERFORMANCE.md`](./PERFORMANCE.md)).

---

## 2. Setup inicial

> Confira a doc versionada do Expo SDK 57 antes de mexer no toolchain — https://docs.expo.dev/versions/v57.0.0/.

### 2.1 Instalar

```bash
pnpm add nativewind tailwindcss react-native-reanimated react-native-safe-area-context
pnpm add -D tailwindcss
```

> `react-native-reanimated` é dependência do NativeWind v4 (usa worklets para variantes/transições). Já faz parte da stack (ver [`../SKILL.md`](../SKILL.md) §2).

### 2.2 `babel.config.js`

O preset do Expo recebe `jsxImportSource: "nativewind"` e adicionamos `nativewind/babel`:

```js
// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
```

### 2.3 `metro.config.js`

Envolva o config do Metro com `withNativeWind`, apontando para o `global.css`:

```js
// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
```

### 2.4 `tailwind.config.js`

**Aqui mora o tema.** Preset do NativeWind + `content` explícito apontando para `./src`:

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "hsl(0 0% 100%)",
        foreground: "hsl(222.2 84% 4.9%)",
        card: "hsl(0 0% 100%)",
        primary: "hsl(221.2 83.2% 53.3%)",
        "primary-foreground": "hsl(210 40% 98%)",
        secondary: "hsl(210 40% 96.1%)",
        "secondary-foreground": "hsl(222.2 47.4% 11.2%)",
        muted: "hsl(210 40% 96.1%)",
        "muted-foreground": "hsl(215.4 16.3% 46.9%)",
        destructive: "hsl(0 84.2% 60.2%)",
        "destructive-foreground": "hsl(210 40% 98%)",
        border: "hsl(214.3 31.8% 91.4%)",
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "8px",
      },
      fontFamily: {
        sans: ["Inter", "System"],
      },
    },
  },
  plugins: [],
};
```

> **Tokens de tema vão em `theme.extend`** — é o equivalente mobile do `@theme` da web. Ao mudar a marca, mexa aqui e tudo se atualiza. Não use `@theme` no CSS: isso é a história CSS-first da v4 web e **não** se aplica ao NativeWind.

### 2.5 `global.css`

Diferente da web (que usa `@import "tailwindcss"`), o NativeWind usa as três diretivas clássicas:

```css
/* global.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Importe **uma única vez** na raiz do app (root layout do Expo Router):

```tsx
// src/app/_layout.tsx
import "../../global.css";

import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack />;
}
```

> Guard de auth e providers no root layout: ver [`NAVIGATION.md`](./NAVIGATION.md).

### 2.6 TypeScript — tipos de `className`

Crie (ou confirme) um `nativewind-env.d.ts` na raiz para o TS aceitar `className` nos primitivos RN:

```ts
// nativewind-env.d.ts
/// <reference types="nativewind/types" />
```

---

## 3. Estrutura de arquivos

```
src/
├── components/
│   ├── ui/                     # primitivos RN + NativeWind — kebab-case (`button.tsx`, `text.tsx`)
│   │   ├── button.tsx
│   │   ├── text.tsx
│   │   ├── input.tsx
│   │   └── card.tsx
│   ├── layout/                 # screen-container.tsx, app-header.tsx
│   ├── shared/                 # compartilhados entre módulos
│   └── <modulo>/               # componentes por módulo (kebab-case)
└── lib/
    └── utils.ts                # função cn() (clsx + tailwind-merge)

global.css                      # @tailwind base/components/utilities (importado no root layout)
tailwind.config.js              # preset nativewind + content + theme.extend
babel.config.js                 # jsxImportSource: "nativewind" + nativewind/babel
metro.config.js                 # withNativeWind(config, { input: "./global.css" })
nativewind-env.d.ts             # tipos de className
```

**Não há shadcn/ui** — shadcn é web-only (Radix + DOM). No mobile recriamos os primitivos em `src/components/ui/` com RN + NativeWind e controle total ([`../SKILL.md`](../SKILL.md) §2).

---

## 4. Configuração — resumo do que muda vs. o front web

| Front web (Tailwind v4 CSS-first) | Mobile (NativeWind v4) |
|---|---|
| `@import "tailwindcss";` no CSS | `@tailwind base; @tailwind components; @tailwind utilities;` no `global.css` |
| Sem `tailwind.config.ts` | `tailwind.config.js` **obrigatório** (com `presets: [require("nativewind/preset")]`) |
| Tokens em `@theme { --color-*: ... }` | Tokens em `theme.extend` do config |
| Detecção automática de conteúdo | `content: ["./src/**/*.{ts,tsx}"]` explícito |
| `@custom-variant dark (...)` no CSS | `darkMode: "class"` + `colorScheme` do NativeWind |
| Vite plugin `@tailwindcss/vite` | Metro `withNativeWind` + Babel `jsxImportSource` |
| Estiliza `div`/`span`/`button` | Estiliza `View`/`Text`/`Pressable` |

---

## 5. Estilizando componentes RN

Aplique `className` diretamente nos primitivos:

```tsx
import { View, Text, Pressable } from "react-native";

function UserCard({ name }: { name: string }) {
  return (
    <View className="rounded-lg border border-border bg-card p-4">
      <Text className="text-base font-medium text-foreground">{name}</Text>
      <Pressable className="mt-2 rounded-md bg-primary px-4 py-2 active:opacity-80">
        <Text className="text-center text-primary-foreground">Ver detalhes</Text>
      </Pressable>
    </View>
  );
}
```

**Notas RN-específicas:**
- Texto **sempre** dentro de `<Text>` — RN não renderiza string solta em `View`.
- Layout é flexbox; não há `block`/`inline`. `flex-row` para linha, coluna é o default.
- `active:` cobre o toque (não há `hover:`). `focus:` funciona em inputs.
- Alvos de toque ≥ 44pt (ver §10).

### 5.1 `cssInterop` para componentes de terceiros

Componentes que não são RN-core não entendem `className` por padrão. Habilite com `cssInterop` (mapeia `className` → prop de estilo):

```tsx
import { cssInterop } from "nativewind";
import { LinearGradient } from "expo-linear-gradient";

cssInterop(LinearGradient, { className: "style" });
```

`expo-image` e a maioria dos primitivos RN já vêm mapeados; use `cssInterop` só quando um componente ignorar `className`.

---

## 6. Dark mode

NativeWind resolve `dark:` via `colorScheme`. Diferente da web (classe `.dark` no `<html>` + `next-themes`), aqui o estado vem de `nativewind`.

### 6.1 Ler e alternar o tema

```tsx
// src/components/shared/theme-toggle.tsx
import { Pressable, Text } from "react-native";
import { useColorScheme } from "nativewind";

export function ThemeToggle() {
  const { colorScheme, setColorScheme } = useColorScheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Alternar tema"
      onPress={() => setColorScheme(colorScheme === "dark" ? "light" : "dark")}
      className="rounded-md p-2 active:opacity-70"
    >
      <Text className="text-foreground">
        {colorScheme === "dark" ? "Claro" : "Escuro"}
      </Text>
    </Pressable>
  );
}
```

`useColorScheme()` retorna `colorScheme` (`"light" | "dark"`) e `setColorScheme` (`"light" | "dark" | "system"`).

### 6.2 Classes `dark:`

```tsx
<View className="bg-background dark:bg-background">
  <Text className="text-foreground dark:text-foreground">Olá</Text>
</View>
```

> Como os tokens (`background`, `foreground`, etc.) já mudam de valor por variante no config, muitas telas não precisam repetir `dark:` — basta usar o token semântico. Use `dark:` quando o valor não vier de um token que troca sozinho.

### 6.3 Persistir a escolha do usuário

O tema escolhido some ao fechar o app se não for persistido. Guarde em AsyncStorage e reaplique no boot com `colorScheme.set()` (a API imperativa fora de componentes):

```tsx
// src/hooks/common/use-color-scheme.ts
import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colorScheme } from "nativewind";

const STORAGE_KEY = "@finance-app/color-scheme";

export function useHydrateColorScheme() {
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "light" || saved === "dark") colorScheme.set(saved);
    });
  }, []);
}

export async function persistColorScheme(scheme: "light" | "dark" | "system") {
  colorScheme.set(scheme);
  await AsyncStorage.setItem(STORAGE_KEY, scheme);
}
```

Chame `useHydrateColorScheme()` no root layout. `colorScheme.set()` (import de `nativewind`) é a versão imperativa de `setColorScheme`; use-a fora de componentes React.

---

## 7. A função `cn` — combinando classes

`src/lib/utils.ts`:

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**O que faz:** combina condicionais (via `clsx`) e resolve conflitos do Tailwind (via `tailwind-merge`). `cn("p-4", "p-2")` → `"p-2"` (último vence). Idêntico ao front web.

**Uso:**

```tsx
<View
  className={cn(
    "rounded-lg border border-border p-4",
    isActive && "border-primary bg-primary/10",
    className, // override do consumer
  )}
/>
```

**Sempre use `cn`** em vez de template strings para classes condicionais. Garante override correto de utilities conflitantes.

---

## 8. Variants — CVA (class-variance-authority)

Para primitivos com múltiplas variações (button: primary/secondary/destructive × sm/md/lg), o padrão CVA vale igual à web:

```tsx
// src/components/ui/button.tsx
import { Pressable, Text, type PressableProps } from "react-native";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "flex-row items-center justify-center rounded-md active:opacity-80 disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary",
        destructive: "bg-destructive",
        outline: "border border-border bg-background",
        secondary: "bg-secondary",
        ghost: "bg-transparent",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 px-3",
        lg: "h-12 px-8",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

const textVariants = cva("text-base font-medium", {
  variants: {
    variant: {
      default: "text-primary-foreground",
      destructive: "text-destructive-foreground",
      outline: "text-foreground",
      secondary: "text-secondary-foreground",
      ghost: "text-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});

interface ButtonProps
  extends PressableProps,
    VariantProps<typeof buttonVariants> {
  label: string;
  className?: string;
}

export function Button({ variant, size, label, className, ...props }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      <Text className={textVariants({ variant })}>{label}</Text>
    </Pressable>
  );
}
```

**Diferença vs. web:** não há elemento único que carregue tudo — o container (`Pressable`) e o `<Text>` interno recebem variants separados, porque no RN cor de texto não herda de `View`.

---

## 9. Padrões de uso

### 9.1 Composição

```tsx
import { View } from "react-native";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

<Card>
  <CardHeader>
    <CardTitle>Novo usuário</CardTitle>
  </CardHeader>
  <CardContent>
    <Button label="Criar" onPress={handleCreate} />
  </CardContent>
</Card>;
```

### 9.2 Navegação a partir de um botão

Sem `asChild`/Radix — use `<Link asChild>` do Expo Router envolvendo um `Pressable`, ou `router.push()` no `onPress`:

```tsx
import { Link } from "expo-router";
import { Button } from "@/components/ui/button";

<Link href="/users" asChild>
  <Button label="Ver usuários" />
</Link>;
```

Detalhes de navegação em [`NAVIGATION.md`](./NAVIGATION.md).

---

## 10. Acessibilidade

O RN não herda a a11y do DOM — você declara explicitamente. Regras:

- **`accessibilityRole`** em elementos interativos (`"button"`, `"link"`, `"header"`, `"image"`).
- **`accessibilityLabel`** em ícones-botão sem texto visível.
- **`accessibilityState`** para `disabled`/`selected`/`checked`.
- **Alvos de toque ≥ 44pt** (iOS HIG / Material). Use `hitSlop` quando o visual for menor.
- **Cor não é único significante** — não confie só em vermelho/verde.
- **Contraste AA** (4.5:1 texto normal, 3:1 grande).
- **Suporte a fonte grande do sistema** (Dynamic Type) — use unidades relativas do tema, evite alturas fixas que cortam texto.

```tsx
<Pressable
  accessibilityRole="button"
  accessibilityLabel="Adicionar usuário"
  hitSlop={8}
  className="h-11 w-11 items-center justify-center rounded-md active:opacity-70"
>
  <PlusIcon />
</Pressable>
```

**Teste com:** VoiceOver (iOS) / TalkBack (Android), o Accessibility Inspector do Xcode, e o modo de fonte grande nas configurações do device. (Sem Lighthouse/axe — são web.)

---

## 11. Convenções de estilo no NativeWind

### 11.1 Quando criar componente vs. classes inline

- **Classes inline:** layout/spacing/cor de uso único.
- **Componente em `ui/`:** padrão repetido em > 3 lugares.
- **Variant CVA:** componente com múltiplas formas.

### 11.2 Tokens de espaçamento (consistência)

Use sempre múltiplos da escala: `p-2, p-4, p-6, p-8`. Evite `p-[13px]` arbitrário.

### 11.3 `StyleSheet` / estilo inline — quando é justificável

NativeWind cobre 95% dos casos. Recorra a `style={...}` ou `StyleSheet.create` só quando:
- Valores animados (Reanimated `useAnimatedStyle` — ver [`PERFORMANCE.md`](./PERFORMANCE.md)).
- Cálculo dinâmico em runtime (ex.: altura vinda de medição de layout).
- Prop de estilo que NativeWind não mapeia num componente de terceiro.

### 11.4 Sem media queries de breakpoint como na web

Mobile é uma faixa estreita de larguras. Prefira `flex`/`flex-wrap` e `useWindowDimensions()` para os poucos casos de tablet/landscape, em vez de `sm:`/`md:`/`lg:` por toda parte.

---

## 12. Ícones

Sem `lucide-react` (web). No mobile use **`lucide-react-native`** ou `@expo/vector-icons`:

```bash
pnpm add lucide-react-native react-native-svg
```

```tsx
import { Plus } from "lucide-react-native";

<Pressable accessibilityRole="button" accessibilityLabel="Adicionar" hitSlop={8}>
  <Plus size={20} className="text-foreground" />
</Pressable>;
```

> `lucide-react-native` renderiza via `react-native-svg`. Passar cor por `className` requer `cssInterop` no ícone, ou use a prop `color`.

---

## 13. Imagens

Sempre **`expo-image`**, nunca o `<Image>` cru do RN (ver [`../SKILL.md`](../SKILL.md) §2):

```tsx
import { Image } from "expo-image";

<Image
  source="https://cdn.exemplo.com/avatar.png"
  placeholder={{ blurhash }}
  contentFit="cover"
  transition={200}
  className="h-16 w-16 rounded-full"
  accessibilityLabel="Foto do usuário"
/>;
```

- `contentFit` (`cover`/`contain`) no lugar de `resizeMode`.
- `placeholder` com blurhash evita "pulo" de layout enquanto carrega.
- Cache e memória gerenciados pelo `expo-image` (ver [`PERFORMANCE.md`](./PERFORMANCE.md)).

---

## 14. Checklist de styling

- [ ] Estiliza primitivos RN (`View`/`Text`/`Pressable`), nunca DOM
- [ ] `className` via NativeWind; `cn()` ao combinar classes condicionais
- [ ] Tema em `tailwind.config.js` `theme.extend` (não `@theme` no CSS)
- [ ] `global.css` importado **uma vez** no root layout
- [ ] Sem cores hardcoded fora do tema (não `bg-blue-500`; use `bg-primary`)
- [ ] Dark mode via `colorScheme`/`dark:`, persistido em AsyncStorage
- [ ] Variants via CVA quando o primitivo tem múltiplas formas
- [ ] `accessibilityRole`/`accessibilityLabel` em interativos; alvos ≥ 44pt
- [ ] Texto sempre dentro de `<Text>`
- [ ] `expo-image` (não `<Image>` do RN); `cssInterop` só quando necessário
- [ ] `StyleSheet`/estilo inline reservado a animação/valores dinâmicos
