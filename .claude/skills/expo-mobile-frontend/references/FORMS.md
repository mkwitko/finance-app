# FORMS.md — React Hook Form + Zod (React Native)

> Formulários com validação tipada em Zod, integrados a inputs **React Native** via `Controller`. Padrão único para todos os forms do app. Sem DOM, sem shadcn — os campos são `TextInput`/`Pressable` estilizados com NativeWind e as mensagens de erro saem num `<Text>`. Contexto geral em [`../SKILL.md`](../SKILL.md).

> ⚠️ **Estado atual do repo.** Este é o **padrão-alvo**. As deps (`react-hook-form`, `@hookform/resolvers`, `zod`) já existem, mas os primitivos de form ainda estão sendo montados. Não há `src/schemas/` ainda. Ao construir o próximo form de verdade, siga este doc e crie `src/schemas/<modulo>/`.

---

## 1. Stack

- **React Hook Form** — gerencia estado do form. Em RN os inputs são **controlados** via `Controller` (não há `ref`/uncontrolled como no DOM), mas o RHF ainda minimiza re-renders isolando cada campo.
- **Zod** — schema de validação. **Mensagens via i18n keys**, nunca hardcoded.
- **`@hookform/resolvers/zod`** — ponte entre Zod e RHF.
- **Primitivos RN + NativeWind** — `TextInput`, `Pressable`, `Text`, estilizados com `className`. Ver [`STYLING.md`](./STYLING.md).

```bash
pnpm add react-hook-form zod @hookform/resolvers
```

> Detalhes do setup de i18n: [`I18N.md`](./I18N.md). O `zod-i18n-map` (mensagens padrão do Zod traduzidas) **ainda não está instalado/wired** — quando adotar Zod nos forms, instale-o e chame `z.setErrorMap`. Esta página foca em **forms** especificamente.

---

## 2. Anatomia de um form completo

Vamos construir um form de criar usuário, do schema ao componente.

### 2.1 Schema Zod

```ts
// src/schemas/users/create-user.schema.ts
import { z } from "zod";

// Mensagens via chave i18n — sem string hardcoded.
// As chaves abaixo correspondem a src/lib/i18n/locales/<lng>/users.json:
//   form.errors.name.required, form.errors.name.tooLong, etc.
export const createUserSchema = z.object({
  name: z
    .string()
    .min(1, { message: "users:form.errors.name.required" })
    .max(120, { message: "users:form.errors.name.tooLong" }),
  email: z
    .string()
    .min(1, { message: "users:form.errors.email.required" })
    .email({ message: "users:form.errors.email.invalid" })
    .max(255, { message: "users:form.errors.email.tooLong" }),
  role: z.enum(["admin", "user", "viewer"], {
    errorMap: () => ({ message: "users:form.errors.role.required" }),
  }),
  bio: z.string().max(500, { message: "users:form.errors.bio.tooLong" }).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
```

**Princípios:**
- Mensagens são **chaves i18n** (formato `<namespace>:<chave>`), não strings localizadas. A tradução acontece no `<FieldError>` que faz `t(error.message)` — ver § 2.2.
- `errorMap` para enums (default da lib fica feio).
- Schema fica em `src/schemas/<modulo>/`, organizado por módulo.
- Type derivado: `z.infer<typeof schema>`.

`src/lib/i18n/locales/pt-BR/users.json`:

```json
{
  "form": {
    "fields": {
      "name": "Nome",
      "email": "E-mail",
      "role": "Papel",
      "bio": "Biografia"
    },
    "errors": {
      "name":  { "required": "Nome é obrigatório", "tooLong": "Nome muito longo" },
      "email": { "required": "E-mail é obrigatório", "invalid": "E-mail inválido", "tooLong": "E-mail muito longo" },
      "role":  { "required": "Selecione um papel" },
      "bio":   { "tooLong": "Máximo 500 caracteres" }
    }
  }
}
```

Mensagens de erros padrão do Zod (`required`, `email`, `min`, `max` genéricos) saem do `zod-i18n-map` automaticamente — você não precisa duplicar essas chaves em cada módulo. Customize apenas o que tem semântica de domínio. Ver [`I18N.md`](./I18N.md).

### 2.2 Componente de erro — `<FieldError>` (RN `Text`, não DOM)

No web esse papel era do `<FormMessageI18n>` (um `<p>` do DOM). Em RN não há `<p>`/`forwardRef<HTMLParagraphElement>` — o erro é um `<Text>` estilizado com NativeWind, que traduz a chave i18n antes de exibir:

```tsx
// src/components/ui/field-error.tsx
import { Text } from "react-native";
import { useTranslation } from "react-i18next";
import type { FieldError as RHFFieldError } from "react-hook-form";

type Props = { error?: RHFFieldError };

export function FieldError({ error }: Props) {
  const { t } = useTranslation();
  if (!error?.message) return null;

  // Se a "message" parecer uma chave i18n (`namespace:caminho`), traduz.
  const message =
    typeof error.message === "string" && error.message.includes(":")
      ? t(error.message)
      : String(error.message);

  return (
    <Text
      className="mt-1 text-sm font-medium text-destructive"
      accessibilityRole="alert"
    >
      {message}
    </Text>
  );
}
```

### 2.3 Campo controlado — `Controller` + `TextInput` estilizado com NativeWind

O padrão canônico de um campo. `Controller` conecta o `TextInput` do RN ao RHF; o `<Text>` label e o `<FieldError>` completam o campo. Tudo estilizado com `className` (NativeWind), com estado de erro via `dark:`/condicional.

```tsx
// src/components/ui/text-field.tsx
import { View, Text, TextInput, type TextInputProps } from "react-native";
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { FieldError } from "@/components/ui/field-error";
import { cn } from "@/lib/utils";

type Props<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  description?: string;
} & Omit<TextInputProps, "onChangeText" | "value" | "onBlur">;

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  ...inputProps
}: Props<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <View className="gap-1">
          <Text className="text-sm font-medium text-foreground">{label}</Text>
          <TextInput
            value={value ?? ""}
            onChangeText={onChange}
            onBlur={onBlur}
            accessibilityLabel={label}
            placeholderTextColor="#9ca3af"
            className={cn(
              "rounded-lg border border-input bg-background px-3 py-3 text-base text-foreground",
              "focus:border-primary",
              error && "border-destructive",
            )}
            {...inputProps}
          />
          {description ? (
            <Text className="text-xs text-muted-foreground">{description}</Text>
          ) : null}
          <FieldError error={error} />
        </View>
      )}
    />
  );
}
```

Agora o form fica declarativo — sem `<form>`, sem `<input>`, sem `onSubmit` do DOM. O submit é o `handleSubmit` do RHF disparado por um `Pressable`/`Button`:

```tsx
// src/components/users/user-form.tsx
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { RoleSelect } from "@/components/users/role-select"; // Controller-wrapped, mesmo padrão
import { createUserSchema, type CreateUserInput } from "@/schemas/users/create-user.schema";

type Props = {
  defaultValues?: Partial<CreateUserInput>;
  onSubmit: (values: CreateUserInput) => Promise<void> | void;
  isSubmitting?: boolean;
};

export function UserForm({ defaultValues, onSubmit, isSubmitting }: Props) {
  const { t } = useTranslation(["users", "common"]);
  const { control, handleSubmit, reset } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      role: "user",
      bio: "",
      ...defaultValues,
    },
  });

  return (
    <View className="gap-6">
      <TextField
        control={control}
        name="name"
        label={t("users:form.fields.name")}
        placeholder={t("users:form.placeholders.name")}
        autoCapitalize="words"
      />

      <TextField
        control={control}
        name="email"
        label={t("users:form.fields.email")}
        description={t("users:form.descriptions.email")}
        placeholder={t("users:form.placeholders.email")}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />

      <RoleSelect control={control} name="role" label={t("users:form.fields.role")} />

      <TextField
        control={control}
        name="bio"
        label={t("users:form.fields.bio")}
        multiline
        numberOfLines={4}
      />

      <View className="flex-row justify-end gap-3">
        <Button variant="outline" onPress={() => reset()}>
          {t("common:actions.reset")}
        </Button>
        <Button onPress={handleSubmit(onSubmit)} disabled={isSubmitting}>
          {isSubmitting ? t("common:states.saving") : t("common:actions.save")}
        </Button>
      </View>
    </View>
  );
}
```

> **Diferenças-chave vs. web:** inputs são `TextInput` controlados via `Controller` (não `{...register()}`/refs); teclado configurado por `keyboardType`/`autoCapitalize`/`textContentType` (não `type="email"`/`inputMode`); submit por `onPress={handleSubmit(...)}` (não `<form onSubmit>`); erro num `<Text>` (não `<p>`).

### 2.4 Tela que monta o form + mutation

```tsx
// src/app/(tabs)/users/new.tsx
import { View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateUser } from "@/api/generated/hooks/usersHooks/useCreateUser";
import { UserForm } from "@/components/users/user-form";
import { ScreenContainer } from "@/components/layout/screen-container";
import { USERS } from "@/api/modules";
import { toast } from "@/lib/toast";

export default function NewUserScreen() {
  const { t } = useTranslation("users");
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useCreateUser({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS.queryKeyRoot });
      toast.success(t("feedback.created"));
      router.back();
    },
    onError: (err) => {
      toast.error(err.message ?? t("feedback.createError"));
    },
  });

  return (
    <ScreenContainer>
      <View className="mx-auto w-full max-w-2xl">
        <UserForm
          isSubmitting={isPending}
          onSubmit={async (data) => {
            await mutateAsync({ data });
          }}
        />
      </View>
    </ScreenContainer>
  );
}
```

---

## 3. Estratégias de validação

### 3.1 Quando validar

RHF default: `onSubmit`. Para feedback mais rápido:

```ts
useForm({
  resolver: zodResolver(schema),
  mode: "onBlur",             // valida ao sair do campo (blur do TextInput)
  reValidateMode: "onChange", // após primeiro erro, valida a cada digitação
});
```

**Recomendação:** `onBlur` + `reValidateMode: "onChange"`. Equilibra UX (sem spammar erros enquanto digita) com rapidez de feedback. Em mobile o blur acontece ao tocar fora do campo ou avançar o teclado.

### 3.2 Validações cruzadas (campos dependentes)

```ts
const schema = z.object({
  password: z.string().min(8),
  passwordConfirm: z.string(),
}).refine((data) => data.password === data.passwordConfirm, {
  message: "users:form.errors.passwordMismatch",
  path: ["passwordConfirm"],
});
```

### 3.3 Validação assíncrona (e-mail único, etc)

Para validações que requerem API call, use `mode: "onBlur"` + lógica no `superRefine`:

```ts
const schema = z.object({
  email: z.string().email(),
}).superRefine(async (data, ctx) => {
  const exists = await checkEmailExists(data.email);
  if (exists) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "users:form.errors.email.taken",
      path: ["email"],
    });
  }
});
```

> Debounce e cache se for chamar API a cada blur. Considere fazer a validação **só no submit** se o feedback "live" não compensar o request extra — importante em rede móvel.

---

## 4. Reaproveitando schema para criar/editar

```ts
// src/schemas/users/user.schema.ts
const baseUser = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(255),
  role: z.enum(["admin", "user", "viewer"]),
});

export const createUserSchema = baseUser.extend({
  password: z.string().min(8),
});

export const updateUserSchema = baseUser.partial(); // tudo opcional para PATCH
```

---

## 5. Tipos compartilhados com schema do backend (Kubb)

> ⚠️ **O Kubb deste repo NÃO gera schemas Zod** — o `kubb.config.ts` não inclui `pluginZod` (ver [`KUBB.md`](./KUBB.md)). Logo **não existe** `src/api/generated/zod/`. Você sempre escreve seus próprios schemas Zod do form em `src/schemas/<modulo>/`.

Os **types** do Kubb (de `pluginTs`) ainda ajudam: use-os para tipar o payload da mutation. Mas a validação do form é um schema Zod escrito à mão:

```ts
import type { CreateUserMutationRequest } from "@/api/generated/types/CreateUser";
import { z } from "zod";

// Schema do FORM (o que o usuário digita) — escrito à mão, mensagens via i18n.
export const createUserSchema = z.object({ /* ... */ }) satisfies z.ZodType<Partial<CreateUserMutationRequest>>;
```

**Regra:** o schema do form é definido pelo que o **usuário** insere; o type do Kubb é definido pelo que a **API** aceita. Eles raramente são idênticos (campos UI-only como `passwordConfirm`/`acceptTerms`, mensagens em pt-BR, múltiplos endpoints).

---

## 6. Padrões comuns

### 6.1 Field array (lista dinâmica de itens)

```tsx
import { View } from "react-native";
import { useFieldArray, useFormContext } from "react-hook-form";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";

const schema = z.object({
  guests: z.array(z.object({
    name: z.string().min(1),
    email: z.string().email(),
  })).min(1, "bookings:form.errors.guests.min"),
});

function GuestsField() {
  const { control } = useFormContext<z.infer<typeof schema>>();
  const { fields, append, remove } = useFieldArray({ control, name: "guests" });

  return (
    <View className="gap-3">
      {fields.map((field, index) => (
        <View key={field.id} className="flex-row items-end gap-2">
          <TextField control={control} name={`guests.${index}.name`} label="Nome" />
          <TextField control={control} name={`guests.${index}.email`} label="E-mail" keyboardType="email-address" />
          <Button variant="ghost" onPress={() => remove(index)}>Remover</Button>
        </View>
      ))}
      <Button onPress={() => append({ name: "", email: "" })}>Adicionar convidado</Button>
    </View>
  );
}
```

### 6.2 Watch — derivar UI de valores

```tsx
import { useWatch } from "react-hook-form";

const role = useWatch({ control, name: "role" });

{role === "admin" && (
  <TextField control={control} name="adminScope" label="Escopo" />
)}
```

> **Uso moderado:** cada `watch`/`useWatch` força re-render. Prefira `useWatch` com `name` específico a `watch()` sem argumento.

### 6.3 Reset após sucesso

```tsx
const { mutate } = useCreateUser({
  onSuccess: () => {
    reset();
    toast.success(t("feedback.created"));
  },
});
```

### 6.4 Mostrar erro de API mapeado em campos

Backend retorna `ApiError` com payload `{ code: "EMAIL_TAKEN", field: "email" }` em `.data`:

```tsx
const { setError } = useForm(/* ... */);

const { mutateAsync } = useCreateUser({
  onError: (err) => {
    if (err.data?.code === "EMAIL_TAKEN") {
      setError("email", { message: "users:form.errors.email.taken" });
    } else {
      toast.error(err.message);
    }
  },
});
```

---

## 7. Acessibilidade em forms (RN)

RN não tem `<label htmlFor>`/`aria-*` do DOM — o equivalente são props de acessibilidade nativas:

**Sua parte:**
- `accessibilityLabel` em cada `TextInput` (o `<FieldError>` usa `accessibilityRole="alert"` pra ser anunciado).
- `keyboardType` correto (`email-address`, `numeric`, `decimal-pad`, `phone-pad`, `url`).
- `autoComplete` / `textContentType` (iOS) para preenchimento automático e gerenciadores de senha (`emailAddress`, `password`, `oneTimeCode`, `newPassword`).
- `autoCapitalize` (`none` para e-mail/senha, `words` para nomes) e `autoCorrect={false}` onde faz sentido.
- `returnKeyType` + `onSubmitEditing` para avançar entre campos e submeter no teclado.
- Alvos de toque ≥ 44pt em botões.
- **Não esconda labels** ("placeholder como label" é antipattern — labels são `<Text>` visíveis).

---

## 8. Performance

Em RN todos os campos são controlados, então o cuidado com re-render é ainda mais relevante:

### 8.1 Não use `watch()` sem argumento no topo

```tsx
// ❌ re-renderiza todo o form a cada keypress
const allValues = watch();

// ✅ subscreve só ao que precisa
const role = useWatch({ control, name: "role" });
```

### 8.2 `Controller` isola o re-render por campo

O padrão `TextField` acima usa `Controller` — cada campo re-renderiza sozinho ao mudar, sem repintar o form inteiro. É o motivo de encapsular o campo num componente próprio.

### 8.3 Forms grandes

Para forms com > 30 campos, considere:
- Quebrar em steps (wizard entre telas do Expo Router, ou steps num `ScrollView`).
- Schema por step + merge no final.
- `KeyboardAvoidingView` + `ScrollView keyboardShouldPersistTaps="handled"` para o teclado não cobrir o campo ativo.

---

## 9. Testes

Com `@testing-library/react-native` (não `@testing-library/react`/`user-event` do DOM):

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { UserForm } from "./user-form";

test("valida e-mail", async () => {
  const onSubmit = jest.fn();
  render(<UserForm onSubmit={onSubmit} />);

  fireEvent.changeText(screen.getByLabelText("E-mail"), "invalido");
  fireEvent.press(screen.getByText(/salvar/i));

  expect(await screen.findByText("E-mail inválido")).toBeTruthy();
  expect(onSubmit).not.toHaveBeenCalled();
});

test("submete dados válidos", async () => {
  const onSubmit = jest.fn();
  render(<UserForm onSubmit={onSubmit} />);

  fireEvent.changeText(screen.getByLabelText("Nome"), "Alice");
  fireEvent.changeText(screen.getByLabelText("E-mail"), "a@b.com");
  fireEvent.press(screen.getByText(/salvar/i));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledWith({
      name: "Alice",
      email: "a@b.com",
      role: "user",
      bio: "",
    });
  });
});
```

Veja [`TESTING.md`](./TESTING.md) para o padrão completo (jest-expo + MSW).

---

## 10. Checklist de form

- [ ] Schema Zod em `src/schemas/<modulo>/`
- [ ] Mensagens de erro via **chave i18n** (traduzidas no `<FieldError>`)
- [ ] `zodResolver` no `useForm`
- [ ] `mode: "onBlur"` + `reValidateMode: "onChange"`
- [ ] Campos via `Controller` (`TextField`/`RoleSelect`), nunca `TextInput` solto ligado a `useState`
- [ ] Erro renderizado em `<Text>` (`<FieldError>`), não DOM
- [ ] `keyboardType`/`autoCapitalize`/`autoComplete`/`textContentType` corretos
- [ ] `accessibilityLabel` em todos os inputs; alvos ≥ 44pt
- [ ] `disabled` no botão de submit durante a mutation
- [ ] Sucesso: toast + invalidate query + `router.back()`/navigate
- [ ] Erro: toast + (se campo específico) `setError`
- [ ] Reset após sucesso quando apropriado
- [ ] Teste (@testing-library/react-native) cobre validação + submit + erro de API
