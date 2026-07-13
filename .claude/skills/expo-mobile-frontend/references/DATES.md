# DATES.md — Datas e Timezones no App Mobile

> Backend manda **string ISO 8601 em UTC** com `Z` (ex: `2026-05-27T17:00:00.000Z`). O app **converte para o fuso do device** e exibe no formato local. Conversão é responsabilidade nossa — a regra é explícita em [`backend/docs/DATES.md`](../backend/docs/DATES.md). Contexto geral em [`../SKILL.md`](../SKILL.md).

> Este é o documento mais traiçoeiro do projeto. Leia antes de qualquer feature com data.

---

## 1. Princípios

1. **Backend é UTC.** Toda data que entra/sai da API é string ISO 8601 com `Z` no fim. Nunca offset (`-03:00`), nunca naive (sem timezone). O backend explicitou isso.
2. **`Date` é sempre instante, nunca "data civil".** `new Date("2026-05-27T17:00:00Z")` é **um momento absoluto no tempo**, não "27 de maio". Pensar em "data civil" exige fuso.
3. **Conversão para fuso é uma camada de apresentação.** A lógica de negócio trabalha com `Date` (instante UTC). Só na hora de **exibir** ou de **parsear input do usuário** é que o fuso entra.
4. **Fuso default = fuso do device** (via `expo-localization`, não `Intl` do browser). Usuário pode sobrescrever em "Preferências". Funções de formatação **sempre** recebem o fuso ativo do `useTimezone()`.
5. **Comparações por instante (UTC), nunca por string.** `dateA.getTime() < dateB.getTime()`. Comparar strings ISO funciona por sorte (lexicograficamente equivale em UTC com `Z`), mas é frágil.
6. **Datas civis sem hora** (data de nascimento, validade de documento) são caso especial — ver § 9.

---

## 2. Stack

- **`Date` nativo** — instante absoluto, base de tudo.
- **`expo-localization`** — fuso e locale do device (`getCalendars()[0].timeZone`, `getLocales()`). É a fonte do fuso, no lugar de `Intl.DateTimeFormat().resolvedOptions().timeZone` do browser.
- **`Intl.DateTimeFormat` / `Intl.RelativeTimeFormat`** — formatação locale-aware. O runtime Expo (Hermes) inclui ICU completo, então `Intl` funciona em RN (zero KB).
- **`date-fns`** — manipulação imutável (`addDays`, `isSameDay`, `startOfMonth`, `differenceInMinutes`).
- **`date-fns-tz`** — formatação e conversão com timezone explícito (`formatInTimeZone`, `toZonedTime`, `fromZonedTime`).
- **Sem moment, Day.js, Luxon.** Justificativa em [`DECISIONS.md`](./DECISIONS.md).

```bash
pnpm add date-fns date-fns-tz
npx expo install expo-localization
```

Bundle: ~8KB gzipped no uso típico (tree-shaken).

---

## 3. Detecção do timezone do device

### 3.1 Default: `expo-localization`

`getCalendars()` retorna as preferências de calendário do device (garante ≥ 1 elemento) e cada uma traz o `timeZone` IANA. É a forma canônica em RN — nada de `Intl.DateTimeFormat().resolvedOptions()`.

```ts
// src/lib/datetime/timezone.ts
import { z } from "zod";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCalendars } from "expo-localization";

export function detectDeviceTimezone(): string {
  try {
    return getCalendars()[0]?.timeZone ?? "America/Sao_Paulo";
  } catch {
    return "America/Sao_Paulo"; // fallback determinístico
  }
}

// Schema para validar overrides (lista oficial IANA Time Zone DB)
const timezoneSchema = z.string().refine(
  (tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: "Timezone inválido" },
);

type TimezoneState = {
  override: string | null;          // null = usa o do device
  setOverride: (tz: string | null) => void;
};

// persist em AsyncStorage (RN não tem localStorage) — ver STATE.md §6
export const useTimezoneStore = create<TimezoneState>()(
  persist(
    (set) => ({
      override: null,
      setOverride: (tz) => {
        if (tz !== null) timezoneSchema.parse(tz); // valida antes de salvar
        set({ override: tz });
      },
    }),
    { name: "timezone-pref", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
```

### 3.2 Hook `useTimezone`

Único ponto de entrada. Componentes nunca chamam `getCalendars()` ou leem o store direto.

```ts
// src/hooks/common/use-timezone.ts
import { useMemo } from "react";
import { useTimezoneStore, detectDeviceTimezone } from "@/lib/datetime/timezone";

export function useTimezone(): string {
  const override = useTimezoneStore((s) => s.override);
  return useMemo(() => override ?? detectDeviceTimezone(), [override]);
}
```

```tsx
import { Text } from "react-native";
import { formatDateTime } from "@/lib/datetime/format";
import { useTimezone } from "@/hooks/common/use-timezone";

function BookingRow({ booking }: { booking: Booking }) {
  const tz = useTimezone();
  return <Text>{formatDateTime(booking.startsAt, tz)}</Text>;
}
```

### 3.3 Seletor de timezone (Preferências)

```tsx
// src/components/settings/timezone-select.tsx
import { View, Text, Pressable } from "react-native";
import { useTimezoneStore, detectDeviceTimezone } from "@/lib/datetime/timezone";
import { cn } from "@/lib/utils";

// Lista curada das mais comuns para o caso BR + internacional
const COMMON_TIMEZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Belem",
  "America/Recife",
  "America/Noronha",
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Madrid",
] as const;

export function TimezoneSelect() {
  const override = useTimezoneStore((s) => s.override);
  const setOverride = useTimezoneStore((s) => s.setOverride);
  const detected = detectDeviceTimezone();
  const current = override ?? "auto";

  const options = ["auto", ...COMMON_TIMEZONES] as const;

  return (
    <View className="gap-2">
      {options.map((tz) => (
        <Pressable
          key={tz}
          accessibilityRole="button"
          onPress={() => setOverride(tz === "auto" ? null : tz)}
          className={cn(
            "rounded-lg border border-input px-4 py-3",
            current === tz && "border-primary bg-primary/10",
          )}
        >
          <Text className="text-foreground">
            {tz === "auto" ? `Automático (${detected})` : tz}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
```

> Lista hardcoded em vez do dump completo do IANA (~600 fusos) porque 95% dos casos cabem numa lista curta. Para o catálogo completo, `Intl.supportedValuesOf("timeZone")` funciona no Hermes — mas lista gigante é UX ruim.

---

## 4. Utilitários centrais — `src/lib/datetime/format.ts`

**Todo componente formata data via essas funções.** Nada de `Intl.DateTimeFormat` ou `.toLocaleDateString()` ad hoc espalhado.

```ts
// src/lib/datetime/format.ts
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { ptBR } from "date-fns/locale";
import {
  isSameDay,
  isYesterday as fnsIsYesterday,
  isTomorrow as fnsIsTomorrow,
  differenceInMinutes,
} from "date-fns";

const DEFAULT_LOCALE = ptBR;

/**
 * Converte string ISO em Date, com sanity check.
 * Use ao receber strings de API ou params de rota.
 */
export function parseIso(input: string | Date | null | undefined): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Formato: "27/05/2026" */
export function formatDate(input: string | Date, timezone: string): string {
  const d = parseIso(input);
  if (!d) return "";
  return formatInTimeZone(d, timezone, "dd/MM/yyyy", { locale: DEFAULT_LOCALE });
}

/** Formato: "27/05/2026 14:30" */
export function formatDateTime(input: string | Date, timezone: string): string {
  const d = parseIso(input);
  if (!d) return "";
  return formatInTimeZone(d, timezone, "dd/MM/yyyy HH:mm", { locale: DEFAULT_LOCALE });
}

/** Formato: "14:30" */
export function formatTime(input: string | Date, timezone: string): string {
  const d = parseIso(input);
  if (!d) return "";
  return formatInTimeZone(d, timezone, "HH:mm", { locale: DEFAULT_LOCALE });
}

/** Formato: "27 de maio de 2026, quarta-feira" */
export function formatDateLong(input: string | Date, timezone: string): string {
  const d = parseIso(input);
  if (!d) return "";
  return formatInTimeZone(d, timezone, "d 'de' MMMM 'de' yyyy, EEEE", { locale: DEFAULT_LOCALE });
}

/**
 * "Hoje, 14:30" / "Ontem, 14:30" / "Amanhã, 14:30" / "27/05, 14:30" / "27/05/2026, 14:30"
 * Usado em listas e cards.
 */
export function formatSmart(input: string | Date, timezone: string, now: Date = new Date()): string {
  const d = parseIso(input);
  if (!d) return "";

  const dInTz = toZonedTime(d, timezone);
  const nowInTz = toZonedTime(now, timezone);
  const time = formatInTimeZone(d, timezone, "HH:mm", { locale: DEFAULT_LOCALE });

  if (isSameDay(dInTz, nowInTz)) return `Hoje, ${time}`;
  if (fnsIsYesterday(dInTz)) return `Ontem, ${time}`;
  if (fnsIsTomorrow(dInTz)) return `Amanhã, ${time}`;

  const sameYear = dInTz.getFullYear() === nowInTz.getFullYear();
  return formatInTimeZone(
    d,
    timezone,
    sameYear ? "dd/MM, HH:mm" : "dd/MM/yyyy, HH:mm",
    { locale: DEFAULT_LOCALE },
  );
}

/**
 * Tempo relativo: "em 3 min", "há 2 h", "há 5 dias"
 * Usa Intl.RelativeTimeFormat (Hermes ICU, zero KB extra).
 */
export function formatRelative(input: string | Date, locale = "pt-BR", now: Date = new Date()): string {
  const d = parseIso(input);
  if (!d) return "";
  const diffMin = differenceInMinutes(d, now);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (Math.abs(diffMin) < 1) return rtf.format(0, "minute");
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  if (Math.abs(diffMin) < 60 * 24) return rtf.format(Math.round(diffMin / 60), "hour");
  return rtf.format(Math.round(diffMin / (60 * 24)), "day");
}

/** Intervalo: "27/05, 14:00 – 15:30" / "27/05, 23:00 – 28/05, 01:00" */
export function formatRange(
  startInput: string | Date,
  endInput: string | Date,
  timezone: string,
): string {
  const start = parseIso(startInput);
  const end = parseIso(endInput);
  if (!start || !end) return "";

  const startInTz = toZonedTime(start, timezone);
  const endInTz = toZonedTime(end, timezone);
  const sameDay = isSameDay(startInTz, endInTz);

  if (sameDay) {
    const date = formatInTimeZone(start, timezone, "dd/MM", { locale: DEFAULT_LOCALE });
    const startTime = formatInTimeZone(start, timezone, "HH:mm");
    const endTime = formatInTimeZone(end, timezone, "HH:mm");
    return `${date}, ${startTime} – ${endTime}`;
  }
  const startStr = formatInTimeZone(start, timezone, "dd/MM, HH:mm", { locale: DEFAULT_LOCALE });
  const endStr = formatInTimeZone(end, timezone, "dd/MM, HH:mm", { locale: DEFAULT_LOCALE });
  return `${startStr} – ${endStr}`;
}
```

### 4.1 Hook `useFormat` — atalho que injeta o timezone do device

```ts
// src/hooks/common/use-format.ts
import { useTimezone } from "./use-timezone";
import * as fmt from "@/lib/datetime/format";

export function useFormat() {
  const tz = useTimezone(); // device tz (expo-localization) ou override do usuário
  return {
    date: (input: string | Date) => fmt.formatDate(input, tz),
    dateTime: (input: string | Date) => fmt.formatDateTime(input, tz),
    time: (input: string | Date) => fmt.formatTime(input, tz),
    dateLong: (input: string | Date) => fmt.formatDateLong(input, tz),
    smart: (input: string | Date, now?: Date) => fmt.formatSmart(input, tz, now),
    relative: (input: string | Date, now?: Date) => fmt.formatRelative(input, "pt-BR", now),
    range: (start: string | Date, end: string | Date) => fmt.formatRange(start, end, tz),
  };
}
```

Uso típico:

```tsx
import { View, Text } from "react-native";
import { useFormat } from "@/hooks/common/use-format";

function BookingCard({ booking }: { booking: Booking }) {
  const f = useFormat();
  return (
    <View>
      <Text>{f.smart(booking.startsAt)}</Text>
      <Text>{f.range(booking.startsAt, booking.endsAt)}</Text>
      <Text className="text-xs text-muted-foreground">Criado {f.relative(booking.createdAt)}</Text>
    </View>
  );
}
```

> Para tornar a formatação de datas reativa ao idioma ativo (locale dinâmico), o `useFormat` de i18n injeta o `i18n.language` — ver [`I18N.md`](./I18N.md) §8.

---

## 5. Input — usuário escolhe data/hora

O caminho inverso. O datepicker nativo produz um `Date` (interpretado no fuso do device). Convertemos para **instante UTC** e mandamos pro backend.

### 5.1 Função canônica `zonedFieldsToUtc`

```ts
// src/lib/datetime/parse.ts
import { fromZonedTime, toZonedTime } from "date-fns-tz";

type DateFields = {
  year: number;
  month: number;    // 1-12
  day: number;
  hour: number;     // 0-23
  minute: number;
  second?: number;
};

/**
 * Converte "27/05/2026 14:00 em America/Sao_Paulo" → Date (instante UTC).
 * O Date resultante .toISOString() devolve "2026-05-27T17:00:00.000Z".
 */
export function zonedFieldsToUtc(fields: DateFields, timezone: string): Date {
  const localDate = new Date(
    fields.year,
    fields.month - 1,
    fields.day,
    fields.hour,
    fields.minute,
    fields.second ?? 0,
  );
  // fromZonedTime: "esse Date 'local' representa que horas no fuso X? me devolve o instante UTC equivalente"
  return fromZonedTime(localDate, timezone);
}

/** Inverso: Date UTC → fields no fuso do usuário (útil para popular o form em edição). */
export function utcToZonedFields(date: Date, timezone: string): DateFields {
  const z = toZonedTime(date, timezone);
  return {
    year: z.getFullYear(),
    month: z.getMonth() + 1,
    day: z.getDate(),
    hour: z.getHours(),
    minute: z.getMinutes(),
    second: z.getSeconds(),
  };
}
```

### 5.2 Integração com React Hook Form + datepicker nativo

Form trabalha com `Date` (instante UTC). O picker nativo mostra/edita no fuso do device. Submit envia ISO string. Não há `<input type="date">`/`<input type="time">` — em RN usamos `@react-native-community/datetimepicker` (ou `expo` equivalente) via `Controller`.

```bash
npx expo install @react-native-community/datetimepicker
```

```tsx
// src/components/bookings/booking-form.tsx
import { View } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTimezone } from "@/hooks/common/use-timezone";
import { DateTimeField } from "@/components/ui/date-time-field";
import { Button } from "@/components/ui/button";

const schema = z.object({
  startsAt: z.date(),          // armazenado como Date (instante)
  endsAt: z.date(),
}).refine((d) => d.endsAt > d.startsAt, {
  message: "bookings:form.errors.endBeforeStart",
  path: ["endsAt"],
});

type Input = z.infer<typeof schema>;

export function BookingForm({ defaultStartsAt, defaultEndsAt, onSubmit }: Props) {
  const tz = useTimezone();
  const { control, handleSubmit } = useForm<Input>({
    resolver: zodResolver(schema),
    defaultValues: {
      startsAt: defaultStartsAt ?? new Date(),
      endsAt: defaultEndsAt ?? new Date(Date.now() + 60 * 60_000),
    },
  });

  return (
    <View className="gap-6">
      <Controller
        control={control}
        name="startsAt"
        render={({ field: { value, onChange } }) => (
          <DateTimeField label="Início" value={value} onChange={onChange} timezone={tz} />
        )}
      />
      {/* ... endsAt idem ... */}
      <Button
        onPress={handleSubmit((data) =>
          onSubmit({
            startsAt: data.startsAt.toISOString(), // envia UTC pro backend
            endsAt: data.endsAt.toISOString(),
          }),
        )}
      >
        Salvar
      </Button>
    </View>
  );
}
```

```tsx
// src/components/ui/date-time-field.tsx (esqueleto)
import { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { utcToZonedFields, zonedFieldsToUtc } from "@/lib/datetime/parse";
import { formatDateTime } from "@/lib/datetime/format";

type Props = {
  label: string;
  value: Date;                 // instante UTC
  onChange: (d: Date) => void;
  timezone: string;
};

export function DateTimeField({ label, value, onChange, timezone }: Props) {
  const [mode, setMode] = useState<"date" | "time" | null>(null);
  const fields = utcToZonedFields(value, timezone);

  // O picker nativo entrega um Date no fuso do device; extraímos os campos
  // e reconstruímos o instante UTC via zonedFieldsToUtc para respeitar o `timezone` escolhido.
  const onPicked = (picked: Date | undefined, kind: "date" | "time") => {
    setMode(Platform.OS === "ios" ? mode : null); // Android fecha ao escolher
    if (!picked) return;
    const patch =
      kind === "date"
        ? { year: picked.getFullYear(), month: picked.getMonth() + 1, day: picked.getDate() }
        : { hour: picked.getHours(), minute: picked.getMinutes() };
    onChange(zonedFieldsToUtc({ ...fields, ...patch }, timezone));
  };

  return (
    <View className="gap-1">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <View className="flex-row gap-2">
        <Pressable className="rounded-lg border border-input px-3 py-3" onPress={() => setMode("date")}>
          <Text className="text-foreground">{formatDateTime(value, timezone)}</Text>
        </Pressable>
      </View>
      {mode ? (
        <DateTimePicker
          // Passamos um Date "local" cujos campos batem com o fuso escolhido,
          // pra o picker abrir no dia/hora certos.
          value={new Date(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute)}
          mode={mode}
          onChange={(_e, picked) => onPicked(picked, mode)}
        />
      ) : null}
    </View>
  );
}
```

**Por que o picker recebe um `Date` "local" e não o `value` direto:** o `DateTimePicker` nativo interpreta o `Date` no fuso do device. Precisamos abri-lo no dia/hora **do fuso escolhido** (`timezone`), daí montamos `new Date(fields.year, fields.month-1, ...)`. Esse `Date` é "envenenado" (sua representação UTC é arbitrária), mas só o usamos para popular o picker — o instante real sai de `zonedFieldsToUtc`.

### 5.3 Params de rota com data

Filtros de listagem (`/bookings?from=2026-05-01&to=2026-05-31`) seguem o padrão: usuário escolhe **datas civis** no seu fuso; convertemos pra range UTC ao mandar pra API.

```ts
const schema = z.object({
  from: z.string().date().optional(),   // "2026-05-01"
  to: z.string().date().optional(),
});

// ao chamar API:
const fromUtc = from
  ? zonedFieldsToUtc({ year, month, day, hour: 0, minute: 0 }, tz).toISOString()
  : undefined;
const toUtc = to
  ? zonedFieldsToUtc({ year, month, day, hour: 23, minute: 59, second: 59 }, tz).toISOString()
  : undefined;
```

> "Reservas de maio" significa "00:00:00 do dia 1 ao 23:59:59 do dia 31 **no fuso do usuário**", que vira `2026-05-01T03:00:00Z` a `2026-06-01T02:59:59Z` em SP. A API recebe instantes; o filtro lá é por timestamp absoluto. Trocar de fuso ⇒ resultados podem mudar nas bordas (esperado).

---

## 6. Comparações e operações

Sempre via **instante** (`getTime()` ou `Date`), nunca via string.

```ts
import { isAfter, isBefore, differenceInMinutes, startOfDay, isSameDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

// Comparar dois instantes — fuso não importa
isAfter(parseIso(a)!, parseIso(b)!);

// Diferença em minutos — fuso não importa
differenceInMinutes(parseIso(end)!, parseIso(start)!);

// "Mesma data (civil) no fuso do usuário?" — fuso IMPORTA
const aInTz = toZonedTime(parseIso(a)!, tz);
const bInTz = toZonedTime(parseIso(b)!, tz);
isSameDay(aInTz, bInTz);

// "Início do dia atual no fuso do usuário, em UTC" (ex: pra montar query)
const todayStartUtc = fromZonedTime(startOfDay(toZonedTime(new Date(), tz)), tz);
```

**Regra:** se a operação só depende de instantes (somar minutos, comparar momentos), **não toque em fuso**. Se depende de "dia civil" (mesma data, início da semana, próximo dia útil), **converta pra fuso**, opere com `date-fns`, e converta de volta.

---

## 7. Armadilhas comuns

### 7.1 `new Date("2026-05-27")` interpreta como UTC

```ts
new Date("2026-05-27")           // 2026-05-27T00:00:00Z (UTC!)
new Date("2026-05-27T00:00:00")  // hora local do device (varia)
```

Para um usuário em SP, o primeiro vira "26/05, 21:00" ao formatar. **Bug clássico**. Solução: sempre receba datas com `Z` do backend, ou use `zonedFieldsToUtc` ao construir.

### 7.2 `toLocaleString("pt-BR")` usa o fuso do device

```ts
date.toLocaleString("pt-BR", { dateStyle: "short" });
```

Ignora o override do perfil. **Não use** essa API direto — sempre via `formatInTimeZone` que recebe `tz` explícito.

### 7.3 `getTimezoneOffset()` retorna minutos com **sinal invertido**

Para SP (UTC-3), retorna `180`, não `-180`. Confusão garantida. Não use; use `date-fns-tz`.

### 7.4 DST (horário de verão)

Brasil aboliu em 2019, mas voltar é possível, e usuários no Chile/Europa/EUA têm DST ativo. `date-fns-tz` lida corretamente (mesma noite pode ter 23h ou 25h reais). Não tente reimplementar.

### 7.5 Diferença de 1 dia ao formatar reservas próximas da meia-noite

Reserva às 23:30 UTC de 27/05 → exibida como 20:30 de 27/05 em SP, **mas** como 01:30 de 28/05 em Lisboa. Não é bug; é correto. Se a feature precisa "dia da reserva no fuso do estabelecimento", o backend manda esse fuso junto e formatamos com ele — veja § 9.

### 7.6 `Intl.DateTimeFormat` com `timeZone` inválido lança em runtime

`new Intl.DateTimeFormat("pt-BR", { timeZone: "Foo/Bar" })` → `RangeError` (também no Hermes). Por isso o `timezoneSchema` (§ 3.1) valida antes de salvar override.

### 7.7 Backend pode mandar `null` em campos de data opcionais

Tipos do Kubb refletem isso. Sempre check antes de formatar:

```tsx
{booking.canceledAt && <Text>Cancelado {f.relative(booking.canceledAt)}</Text>}
```

`parseIso(null)` retorna `null`; `f.dateTime(null)` retorna `""` (silencioso). Cheque antes pra não exibir string vazia sem querer.

---

## 8. Testes — como evitar testes flakey

Datas em testes são **a fonte clássica de flakiness**. Três regras (com `jest`/`jest-expo`):

### 8.1 Use fake timers do jest

```ts
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-05-27T17:00:00Z")); // ancora "agora"
});

afterEach(() => {
  jest.useRealTimers();
});
```

`formatSmart`, `formatRelative` e qualquer função que use "agora" passam a ser determinísticas.

### 8.2 Force o `TZ` do ambiente de teste

CI roda em UTC; sua máquina pode estar em outro fuso → testes passam local, falham no CI. Pin via script:

```json
// package.json
{
  "scripts": {
    "test": "TZ=UTC jest",
    "test:ci": "TZ=UTC jest --ci"
  }
}
```

> **Por que UTC, não SP:** `formatInTimeZone(date, "America/Sao_Paulo", ...)` independe do `TZ` do processo — date-fns-tz é determinístico. Mas operações com `Date` "envenenado" (ver § 5.2) podem variar. UTC elimina ambiguidade. Nos testes, mocke `getCalendars` do `expo-localization` para um tz fixo se a lógica ler o device.

### 8.3 Sempre passe `now` explicitamente quando relevante

```ts
test("formata hoje", () => {
  const now = new Date("2026-05-27T17:00:00Z");
  const d = new Date("2026-05-27T19:30:00Z");
  expect(formatSmart(d, "America/Sao_Paulo", now)).toBe("Hoje, 16:30");
});

test("formata ontem na virada da meia-noite", () => {
  const now = new Date("2026-05-27T03:00:00Z");   // 00h em SP, 27/05
  const d = new Date("2026-05-27T02:00:00Z");      // 23h em SP, 26/05
  expect(formatSmart(d, "America/Sao_Paulo", now)).toBe("Ontem, 23:00");
});
```

### 8.4 Teste o caso de DST se sua app pode rodar em fuso com DST

```ts
import { addDays } from "date-fns";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

test("addDays cruza a fronteira do DST corretamente", () => {
  const before = fromZonedTime(new Date(2025, 2, 8, 12, 0), "America/New_York"); // antes do DST
  const result = addDays(before, 1);
  expect(formatInTimeZone(result, "America/New_York", "HH:mm")).toBe("12:00");
});
```

---

## 9. Casos especiais

### 9.1 Data civil pura (sem hora)

"Data de nascimento", "data de validade". Não tem instante — é uma data **independente de fuso**.

Backend pode mandar como `"2026-05-27"` (string sem `Z`). **Não converta para `Date`** — você perde a propriedade "civil".

```ts
const birthDate: string = user.birthDate; // "1990-03-15"
const [y, m, d] = birthDate.split("-").map(Number);
// formate sem conversão
```

Crie helper se aparecer mais de duas vezes:

```ts
// src/lib/datetime/civil.ts
export function formatCivilDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}
```

Não há ambiguidade nem fuso aqui — é uma data como uma cor: dado puro.

### 9.2 Reserva no fuso do estabelecimento

"Hotel em SP recebe reserva pra 14h de SP, hóspede em Lisboa vê a reserva — quer ver 14h também, não 18h."

**Solução:** backend manda o fuso do estabelecimento junto. Frontend formata explicitamente nesse fuso, ignorando o do device:

```ts
type Booking = {
  startsAt: string;            // "2026-05-27T17:00:00Z"
  venueTimezone: string;       // "America/Sao_Paulo"
};
```

```tsx
<Text>{formatDateTime(booking.startsAt, booking.venueTimezone)}</Text>
<Text className="text-xs">(horário do local)</Text>
```

Se "horário do local" tem que aparecer junto com "seu horário", mostre os dois:

```tsx
<View>
  <Text>Início: {formatDateTime(booking.startsAt, booking.venueTimezone)} ({booking.venueTimezone})</Text>
  <Text>No seu fuso: {formatDateTime(booking.startsAt, userTz)}</Text>
</View>
```

Não use `useTimezone()` cego pra esse caso — fuso do estabelecimento vem da API.

### 9.3 "Quantos dias até a reserva"

```ts
import { differenceInCalendarDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const days = differenceInCalendarDays(
  toZonedTime(parseIso(booking.startsAt)!, tz),
  toZonedTime(new Date(), tz),
);
```

`differenceInCalendarDays` usa a virada do dia **civil**, não 24h cheias.

---

## 10. Integração com Expo Router (search params)

Expo Router expõe query params via `useLocalSearchParams()`. Em vez de instantes na URL (feio, dependente de fuso), passe **datas civis** e converta pra instante na chamada da API.

```tsx
import { useLocalSearchParams } from "expo-router";
import { z } from "zod";

const searchSchema = z.object({
  from: z.string().date().optional(),   // YYYY-MM-DD (civil)
  to: z.string().date().optional(),
});

function BookingsListScreen() {
  const raw = useLocalSearchParams<{ from?: string; to?: string }>();
  const { from, to } = searchSchema.parse(raw);
  // converte from/to (civis) → instante UTC na chamada da API (ver §5.3)
}
```

Params ficam legíveis e a rota é deep-linkável.

---

## 11. Display em locale ≠ pt-BR (preparação futura)

Quando ativarmos `en`/`es`, `formatInTimeZone` aceita locale dinâmico:

```ts
import { ptBR, enUS, es } from "date-fns/locale";

const LOCALES = { "pt-BR": ptBR, "en": enUS, "es": es };

export function formatDateTime(input: string | Date, timezone: string, locale = "pt-BR") {
  return formatInTimeZone(input, timezone, "PPp", { locale: LOCALES[locale] });
}
```

`"PPp"` é um **token de locale** do date-fns — "long date + time" no estilo nativo do idioma. Use tokens de locale (`PPp`, `PPPp`, `pp`) em vez de `dd/MM/yyyy` hardcoded quando a feature for i18n-ready de verdade. O `useFormat()` deve receber o locale ativo do i18next — ver [`I18N.md`](./I18N.md).

---

## 12. Checklist (PR review)

- [ ] Nenhuma chamada direta a `.toLocaleDateString`, `.toLocaleString`, `Intl.DateTimeFormat` fora de `src/lib/datetime/`
- [ ] Nenhum `new Date("YYYY-MM-DD")` sem `Z` ou sem `T...` (interpretação UTC silenciosa)
- [ ] Formatação usa `useFormat()` ou função de `format.ts`
- [ ] Timezone vem de `useTimezone()` (device via `expo-localization`), não de `Intl`/browser
- [ ] Comparações usam `Date.getTime()` ou `date-fns` (`isAfter`, `isBefore`)
- [ ] Operações "no dia civil" usam `toZonedTime` antes
- [ ] Submit de form envia `Date.toISOString()` (com `Z`)
- [ ] Input de data usa datepicker nativo + `zonedFieldsToUtc` (não `<input type=date>`)
- [ ] Store de override de tz persiste em AsyncStorage (não localStorage)
- [ ] Testes definem `TZ=UTC` e usam `jest.useFakeTimers` + `jest.setSystemTime`
- [ ] Datas civis sem hora não passam por `new Date()` — tratadas como string
- [ ] Reservas com fuso do estabelecimento usam o `venueTimezone` da API, não `useTimezone()`
- [ ] `null`/`undefined` checados antes de formatar
