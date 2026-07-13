# UPLOADS.md — Upload de Arquivos (React Native)

> Backend gera **presigned URLs** do S3 (gateway já existe). O app escolhe o arquivo (foto da câmera/galeria ou documento) → valida → pede URL → faz PUT direto pro S3 → notifica o backend da conclusão. **O contrato do backend é idêntico ao do frontend web** — o que muda é o *pick* (pickers nativos + permissões) e o *PUT* (a partir de um `uri` de arquivo local, não de um `File` do DOM). Contexto geral em [`../SKILL.md`](../SKILL.md).

> ⚠️ **Estado atual do repo: upload NÃO implementado.** Este doc descreve o **padrão-alvo**. Não há `src/lib/uploads/`, nem hook `useFileUpload`, nem endpoints de upload no `api.json`. O client de fetch (`src/api/client.ts`) já suporta `FormData`, então a base existe. Ao implementar, siga este doc e crie `src/lib/uploads/`.

---

## 1. Fluxo end-to-end

```
[1] Usuário escolhe arquivo (expo-image-picker OU expo-document-picker)
        ↓
[2] App valida: tipo MIME, tamanho, extensão, dimensão (imagem — vem no asset)
        ↓
[3] App pede URL: POST /v1/uploads/presign { filename, contentType, size }
        ↓
[4] Backend valida limites + gera URL: { url, key, expiresAt }
        ↓
[5] App faz PUT direto no S3 a partir do file:// uri (fetch ou expo-file-system)
        ↓
[6] App notifica backend: POST /v1/<recurso>/<id>/attachments { key, ... }
        ↓
[7] Backend valida que o objeto existe (HeadObject), salva no DB, retorna entidade
```

**Por que dois passos no backend (presign + notify) e não um só** — idêntico ao web:
- Presign apenas autoriza o upload. Nada existe no DB ainda.
- Após upload, o backend confirma que o objeto existe (size/etag certo) antes de criar a entidade.
- Se o cliente desistir entre `[5]` e `[6]`, um lifecycle policy do S3 limpa `uploads/pending/` depois de 24h.

**Por que PUT direto no S3 (não proxy pela API):**
- API não consome RAM/CPU com bytes grandes.
- Aproveita banda do S3 (edges multi-region) — importante em rede móvel.
- Permite arquivos grandes sem limites do ALB.

---

## 2. Escolha do arquivo — pickers nativos + permissões

Em RN não há `<input type="file">`. Há dois pickers, conforme o tipo de conteúdo:

- **`expo-image-picker`** — fotos/vídeos da **galeria** ou tiradas na **câmera**. Requer permissão (media library / camera).
- **`expo-document-picker`** — arquivos arbitrários (PDF, etc). Não requer permissão de galeria.

```bash
npx expo install expo-image-picker expo-document-picker expo-file-system
```

Plugins/permissões no `app.json` (strings de justificativa exigidas pela App Store):

```json
{
  "expo": {
    "plugins": [
      ["expo-image-picker", {
        "photosPermission": "Precisamos acessar suas fotos para anexar imagens.",
        "cameraPermission": "Precisamos da câmera para tirar fotos do anexo."
      }]
    ]
  }
}
```

### 2.1 Um "asset" normalizado (não existe `File` em RN)

Todo o resto do fluxo trabalha com este shape em vez do `File` do DOM:

```ts
// src/lib/uploads/types.ts
export type PickedAsset = {
  uri: string;          // file:// local uri
  name: string;         // nome do arquivo
  mimeType: string;     // ex.: "image/jpeg", "application/pdf"
  size: number;         // bytes
  width?: number;       // imagens (o picker já entrega)
  height?: number;
};
```

### 2.2 Pick de imagem (galeria)

`expo-image-picker` retorna `{ canceled, assets }`. Pedimos a permissão antes.

```ts
// src/lib/uploads/pick.ts
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import type { PickedAsset } from "./types";

export async function pickImageFromLibrary(): Promise<PickedAsset | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null; // trate na UI: mostrar aviso + link pras Configurações

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
  });
  if (result.canceled) return null;

  const a = result.assets[0];
  return {
    uri: a.uri,
    name: a.fileName ?? a.uri.split("/").pop() ?? "image.jpg",
    mimeType: a.mimeType ?? "image/jpeg",
    size: a.fileSize ?? 0,
    width: a.width,
    height: a.height,
  };
}

export async function takePhoto(): Promise<PickedAsset | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
  if (result.canceled) return null;

  const a = result.assets[0];
  return {
    uri: a.uri,
    name: a.fileName ?? "photo.jpg",
    mimeType: a.mimeType ?? "image/jpeg",
    size: a.fileSize ?? 0,
    width: a.width,
    height: a.height,
  };
}

export async function pickDocument(accept: string[]): Promise<PickedAsset | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: accept,               // ex.: ["application/pdf"]
    copyToCacheDirectory: true, // garante um file:// uri estável para o PUT
  });
  if (result.canceled) return null;

  const a = result.assets[0];
  return {
    uri: a.uri,
    name: a.name,
    mimeType: a.mimeType ?? "application/octet-stream",
    size: a.size ?? 0,
  };
}
```

> **Permissões negadas:** `requestMediaLibraryPermissionsAsync`/`requestCameraPermissionsAsync` retornam `{ granted, canAskAgain }`. Se `canAskAgain === false`, o usuário negou permanentemente — mostre um aviso com botão que abre as Configurações (`Linking.openSettings()`).

---

## 3. Validação no app

**Regra:** valide **tudo** no app pra UX (feedback imediato) **e** confie que o backend revalida (segurança).

### 3.1 Constraints centralizados

```ts
// src/lib/uploads/constraints.ts
export const UPLOAD_LIMITS = {
  avatar: {
    maxBytes: 2 * 1024 * 1024,           // 2 MB
    accept: ["image/jpeg", "image/png", "image/webp"],
    maxWidth: 4096,
    maxHeight: 4096,
  },
  bookingAttachment: {
    maxBytes: 20 * 1024 * 1024,          // 20 MB
    accept: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  },
  document: {
    maxBytes: 50 * 1024 * 1024,
    accept: ["application/pdf", "image/jpeg", "image/png"],
  },
} as const satisfies Record<string, UploadConstraint>;

export type UploadConstraint = {
  maxBytes: number;
  accept: readonly string[];
  maxWidth?: number;
  maxHeight?: number;
};

export type UploadKind = keyof typeof UPLOAD_LIMITS;
```

### 3.2 Função de validação

Diferente do web: a dimensão da imagem **já vem no asset** (`width`/`height` do picker), então não precisamos de `Image`/`URL.createObjectURL` para medir.

```ts
// src/lib/uploads/validate.ts
import { UPLOAD_LIMITS, type UploadKind } from "./constraints";
import type { PickedAsset } from "./types";

export type ValidationError =
  | { code: "TYPE_NOT_ALLOWED"; expected: readonly string[]; got: string }
  | { code: "TOO_LARGE"; max: number; got: number }
  | { code: "DIMENSIONS_TOO_LARGE"; maxWidth: number; maxHeight: number; got: { w: number; h: number } }
  | { code: "EMPTY_FILE" };

export function validateUpload(asset: PickedAsset, kind: UploadKind): ValidationError | null {
  const c = UPLOAD_LIMITS[kind];

  if (asset.size === 0) return { code: "EMPTY_FILE" };
  if (asset.size > c.maxBytes) return { code: "TOO_LARGE", max: c.maxBytes, got: asset.size };
  if (!c.accept.includes(asset.mimeType)) {
    return { code: "TYPE_NOT_ALLOWED", expected: c.accept, got: asset.mimeType };
  }

  if ((c.maxWidth || c.maxHeight) && asset.width && asset.height) {
    if (asset.width > (c.maxWidth ?? Infinity) || asset.height > (c.maxHeight ?? Infinity)) {
      return {
        code: "DIMENSIONS_TOO_LARGE",
        maxWidth: c.maxWidth!,
        maxHeight: c.maxHeight!,
        got: { w: asset.width, h: asset.height },
      };
    }
  }

  return null;
}
```

**Mensagens de erro:** mapeie `ValidationError.code` para chave i18n. Sem `throw`/`Error` aqui — retornamos o tipo pra forçar tratamento explícito.

---

## 4. Hook `useFileUpload`

Encapsula pick → validate → presign → PUT → notify, com progress, cancel e retry. **Hook único** consumido por todas as features (avatar, anexo de reserva, documento).

### 4.1 Tipos de retorno

```ts
// src/lib/uploads/types.ts (continuação)
export type UploadState =
  | { status: "idle" }
  | { status: "validating" }
  | { status: "presigning" }
  | { status: "uploading"; progress: number; loaded: number; total: number }
  | { status: "notifying" }
  | { status: "success"; key: string; entity: unknown }
  | { status: "error"; error: UploadError };

export type UploadError =
  | { kind: "validation"; detail: ValidationError }
  | { kind: "permission_denied" }
  | { kind: "presign_failed"; cause: ApiError }
  | { kind: "upload_failed"; status?: number; cause?: unknown }
  | { kind: "notify_failed"; cause: ApiError }
  | { kind: "canceled" }
  | { kind: "timeout" };
```

### 4.2 Implementação

```ts
// src/lib/uploads/use-file-upload.ts
import { useCallback, useRef, useState } from "react";
import { usePresignUpload } from "@/api/generated/hooks/uploadsHooks/usePresignUpload"; // quando o endpoint existir
import { validateUpload } from "./validate";
import { putToS3 } from "./put-to-s3";
import type { UploadKind } from "./constraints";
import type { PickedAsset, UploadState } from "./types";

type Options = {
  kind: UploadKind;
  notify: (params: { key: string; size: number; contentType: string }) => Promise<unknown>;
  onSuccess?: (entity: unknown) => void;
  onError?: (error: UploadState & { status: "error" }) => void;
};

export function useFileUpload(opts: Options) {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const { mutateAsync: presign } = usePresignUpload();

  const upload = useCallback(async (asset: PickedAsset) => {
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    try {
      // 1. Validate (síncrono em RN — dimensão já vem no asset)
      setState({ status: "validating" });
      const validation = validateUpload(asset, opts.kind);
      if (validation) {
        const err = { status: "error" as const, error: { kind: "validation" as const, detail: validation } };
        setState(err);
        opts.onError?.(err);
        return;
      }

      // 2. Presign
      setState({ status: "presigning" });
      const presigned = await presign({
        data: { filename: asset.name, contentType: asset.mimeType, size: asset.size, kind: opts.kind },
      });
      if (signal.aborted) throw new DOMException("canceled", "AbortError");

      // 3. PUT to S3 a partir do file:// uri
      await putToS3({
        url: presigned.url,
        asset,
        signal,
        onProgress: (loaded, total) => {
          setState({ status: "uploading", progress: total > 0 ? loaded / total : 0, loaded, total });
        },
      });
      if (signal.aborted) throw new DOMException("canceled", "AbortError");

      // 4. Notify backend
      setState({ status: "notifying" });
      const entity = await opts.notify({
        key: presigned.key,
        size: asset.size,
        contentType: asset.mimeType,
      });

      setState({ status: "success", key: presigned.key, entity });
      opts.onSuccess?.(entity);
    } catch (err) {
      const errorState = toErrorState(err);
      setState(errorState);
      opts.onError?.(errorState);
    } finally {
      abortRef.current = null;
    }
  }, [opts, presign]);

  const cancel = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, upload, cancel, reset };
}

function toErrorState(err: unknown): UploadState & { status: "error" } {
  if (err instanceof DOMException && err.name === "AbortError") {
    return { status: "error", error: { kind: "canceled" } };
  }
  // ... mapeia ApiError de presign/notify para presign_failed/notify_failed
  return { status: "error", error: { kind: "upload_failed", cause: err } };
}
```

### 4.3 PUT pro S3 — duas opções em RN

Não há `File`/`XMLHttpRequest.send(file)` como no browser. Duas abordagens:

**(a) `fetch` a partir do `uri`** — simples, mas **sem progresso**. Bom para arquivos pequenos (avatar).

```ts
// putToS3 via fetch (sem progress)
async function putViaFetch(url: string, asset: PickedAsset, signal: AbortSignal) {
  // Em RN, um objeto { uri, name, type } é reconhecido pelo fetch para enviar o binário do arquivo.
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": asset.mimeType }, // DEVE bater com o que foi assinado
    body: { uri: asset.uri, name: asset.name, type: asset.mimeType } as unknown as BodyInit,
    signal,
  });
  if (!res.ok) throw new Error(`S3 PUT failed: ${res.status}`);
}
```

**(b) `expo-file-system` (legacy) `uploadAsync`** — recomendado quando quer robustez e progresso. No SDK 57 o `uploadAsync` vive no submódulo **`expo-file-system/legacy`** (o módulo moderno o deprecou). Use `BINARY_CONTENT` + `httpMethod: "PUT"` para presigned URL (o S3 espera o corpo bruto, não multipart).

```ts
// src/lib/uploads/put-to-s3.ts
import * as FileSystem from "expo-file-system/legacy";
import type { PickedAsset } from "./types";

type Args = {
  url: string;
  asset: PickedAsset;
  signal: AbortSignal;
  onProgress: (loaded: number, total: number) => void;
};

export async function putToS3({ url, asset, signal, onProgress }: Args): Promise<void> {
  if (signal.aborted) throw new DOMException("canceled", "AbortError");

  // createUploadTask expõe callback de progresso e permite cancelar.
  const task = FileSystem.createUploadTask(
    url,
    asset.uri,
    {
      httpMethod: "PUT",
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      // Content-Type DEVE ser idêntico ao enviado no presign.
      headers: { "Content-Type": asset.mimeType },
    },
    (progress) => onProgress(progress.totalBytesSent, progress.totalBytesExpectedToSend),
  );

  // Propaga o AbortController → cancela a task nativa
  signal.addEventListener("abort", () => task.cancelAsync(), { once: true });

  const result = await task.uploadAsync();
  if (!result || result.status < 200 || result.status >= 300) {
    throw new Error(`S3 PUT failed: ${result?.status}`);
  }
}
```

> Import obrigatório de **`expo-file-system/legacy`** — chamar `uploadAsync`/`createUploadTask` do módulo raiz `expo-file-system` lança em runtime no SDK 57. Confira a doc versionada: https://docs.expo.dev/versions/v57.0.0/sdk/filesystem-legacy/.

---

## 5. CORS do bucket — **não se aplica ao app nativo**

No web, o PUT direto do browser exigia CORS no bucket. **Requisições nativas do RN não passam pelo CORS do browser** — não há origin, não há preflight `OPTIONS`. Portanto, para o app iOS/Android **você não precisa configurar CORS**.

> ⚠️ **Exceção:** se você rodar o app via `expo start --web` (react-native-web), o PUT volta a passar pelo fetch do browser e o CORS do bucket importa. Se web for um alvo suportado, mantenha a regra de CORS do bucket permitindo `PUT` + `Content-Type` do origin web. Para builds nativos, ignore.

---

## 6. Content-Type — o detalhe que sempre erra

O presigned URL é assinado **com o Content-Type específico**. Se o app mandar `Content-Type` diferente do que foi enviado no `POST /presign`, o S3 rejeita com 403 SignatureDoesNotMatch.

**Regras:**
- O app manda `asset.mimeType` no presign body.
- O app manda o mesmo `asset.mimeType` no header `Content-Type` do PUT.
- Backend assina o presign com o `contentType` recebido.

**Casos problemáticos:**
- `mimeType` vazio (alguns documentos): use fallback `application/octet-stream` — e o backend deve aceitá-lo.
- Extensão mente sobre o conteúdo: backend valida via magic numbers ou `HeadObject` no S3.
- O `expo-image-picker` às vezes converte HEIC → JPEG ao exportar; garanta que `mimeType` reflete o arquivo **final** (`a.mimeType` do asset), não a extensão original.

---

## 7. Componente `<FilePickerField>` (RN)

No web era um `<FileDropzone>` com drag-and-drop e `<input type=file>`. Em RN é um cartão com botões que abrem os pickers nativos (câmera / galeria / documento), mais o estado do upload.

```tsx
// src/components/shared/file-picker-field.tsx
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons"; // ícones nativos (não lucide-react)
import { useTranslation } from "react-i18next";
import { useFileUpload } from "@/lib/uploads/use-file-upload";
import { pickImageFromLibrary, takePhoto, pickDocument } from "@/lib/uploads/pick";
import type { UploadKind, UploadError } from "@/lib/uploads/constraints";
import { UPLOAD_LIMITS } from "@/lib/uploads/constraints";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { cn } from "@/lib/utils";

type Props = {
  kind: UploadKind;
  notify: (params: { key: string; size: number; contentType: string }) => Promise<unknown>;
  onSuccess?: (entity: unknown) => void;
  className?: string;
};

export function FilePickerField({ kind, notify, onSuccess, className }: Props) {
  const { t } = useTranslation(["common", "uploads"]);
  const { state, upload, cancel, reset } = useFileUpload({ kind, notify, onSuccess });
  const allowsImages = UPLOAD_LIMITS[kind].accept.some((m) => m.startsWith("image/"));

  const handle = async (picker: () => Promise<Awaited<ReturnType<typeof pickImageFromLibrary>>>) => {
    const asset = await picker();
    if (asset) upload(asset);
    // asset === null → cancelado ou permissão negada (a UI de permissão é tratada no picker)
  };

  return (
    <View
      className={cn(
        "rounded-lg border-2 border-dashed border-input p-6",
        state.status === "error" && "border-destructive",
        className,
      )}
    >
      {state.status === "idle" || state.status === "validating" || state.status === "presigning" ? (
        <View className="items-center gap-3">
          <Ionicons name="cloud-upload-outline" size={32} className="text-muted-foreground" />
          <Text className="text-sm text-foreground">{t("uploads:picker.prompt")}</Text>
          <View className="flex-row flex-wrap justify-center gap-2">
            {allowsImages ? (
              <>
                <Button variant="outline" onPress={() => handle(takePhoto)}>
                  {t("uploads:picker.camera")}
                </Button>
                <Button variant="outline" onPress={() => handle(pickImageFromLibrary)}>
                  {t("uploads:picker.gallery")}
                </Button>
              </>
            ) : null}
            <Button
              variant="outline"
              onPress={() => handle(() => pickDocument([...UPLOAD_LIMITS[kind].accept]))}
            >
              {t("uploads:picker.document")}
            </Button>
          </View>
        </View>
      ) : null}

      {state.status === "uploading" || state.status === "notifying" ? (
        <View className="gap-3">
          <ProgressBar value={state.status === "uploading" ? state.progress : 1} />
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-foreground">
              {state.status === "uploading"
                ? `${Math.round(state.progress * 100)}% — ${formatBytes(state.loaded)} / ${formatBytes(state.total)}`
                : t("uploads:state.finalizing")}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t("common:actions.cancel")} onPress={cancel}>
              <Ionicons name="close" size={20} className="text-foreground" />
            </Pressable>
          </View>
        </View>
      ) : null}

      {state.status === "success" ? (
        <View className="items-center gap-2">
          <Ionicons name="checkmark-circle" size={24} color="#16a34a" />
          <Text className="text-sm text-foreground">{t("uploads:state.success")}</Text>
          <Button variant="ghost" onPress={reset}>{t("uploads:actions.replace")}</Button>
        </View>
      ) : null}

      {state.status === "error" ? (
        <View className="items-center gap-2">
          <Ionicons name="alert-circle" size={24} className="text-destructive" />
          <Text className="text-sm text-foreground">{errorMessage(state.error, t)}</Text>
          <Button variant="outline" onPress={reset}>{t("common:actions.tryAgain")}</Button>
        </View>
      ) : null}
    </View>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function errorMessage(err: UploadError, t: (k: string, p?: object) => string): string {
  switch (err.kind) {
    case "validation":        return t(`uploads:errors.${err.detail.code}`, { ...err.detail });
    case "permission_denied": return t("uploads:errors.permission");
    case "canceled":          return t("uploads:errors.canceled");
    case "timeout":           return t("uploads:errors.timeout");
    default:                  return t("uploads:errors.generic");
  }
}
```

---

## 8. Múltiplos arquivos / upload em lote

`launchImageLibraryAsync({ allowsMultipleSelection: true })` já devolve vários assets. Para subir vários, **não use um único `useFileUpload` em loop** — paralelize com limite de concorrência.

```ts
// src/lib/uploads/use-multi-upload.ts
import * as Crypto from "expo-crypto"; // randomUUID em RN (não existe crypto.randomUUID global)

const CONCURRENCY = 3;

export function useMultiUpload(opts: Options) {
  const [items, setItems] = useState<UploadItem[]>([]);

  const uploadAll = async (assets: PickedAsset[]) => {
    const queue = assets.map((asset) => ({ id: Crypto.randomUUID(), asset }));
    setItems(queue.map((q) => ({ id: q.id, name: q.asset.name, status: "idle" })));

    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) return;
        await uploadOne(item); // atualiza items[item.id] em cada estado
      }
    });

    await Promise.all(workers);
  };

  // ...
}
```

Concorrência alta = travas de banda (pior em 4G) + risco de rate limit no presign. **3-5 é seguro.**

---

## 9. Preview antes/durante/depois do upload

Em RN não há `URL.createObjectURL`/`<img>` — o preview usa o `file:// uri` direto no `expo-image` (ver [`../SKILL.md`](../SKILL.md), imagens sempre via `expo-image`):

```tsx
import { Image } from "expo-image";

// Antes (asset escolhido, ainda não subido)
{asset?.mimeType.startsWith("image/") && (
  <Image source={{ uri: asset.uri }} style={{ width: 120, height: 120 }} contentFit="cover" />
)}

// Depois (entidade no backend já tem uma URL de download)
{attachment && (
  <Image source={{ uri: attachment.downloadUrl }} style={{ width: 120, height: 120 }} contentFit="cover" />
)}
```

Não há `URL.revokeObjectURL` a fazer — o `uri` é um arquivo local, gerenciado pelo cache do device. Se você copiou para o cache (`copyToCacheDirectory`), o SO limpa eventualmente; para liberar já, `FileSystem` (legacy) `deleteAsync(uri)` após o sucesso.

---

## 10. Segurança — o que validar no backend

Mesmo o app validando, o backend **revalida tudo** (contrato idêntico ao web):

| Check | Por quê |
|---|---|
| Size do objeto no S3 = size do presign | Cliente pode mandar arquivo maior que o assinado |
| Content-Type via magic numbers (ou `HeadObject`) | Extensão/`mimeType` mentem |
| Owner: usuário autenticado pode acessar a reserva | Atacante chuta IDs |
| Quota por usuário/tenant | Evita spam de uploads |
| Vírus scan (opcional) | S3 + Lambda + ClamAV para anexos públicos |

App **não precisa** se preocupar com isso — backend reject = `notify_failed`, UX já tratada.

---

## 11. i18n — chaves padrão

```json
// src/lib/i18n/locales/pt-BR/uploads.json
{
  "picker": {
    "prompt": "Anexe uma foto ou documento",
    "camera": "Câmera",
    "gallery": "Galeria",
    "document": "Arquivo"
  },
  "state": {
    "validating": "Validando…",
    "uploading": "Enviando…",
    "finalizing": "Finalizando…",
    "success": "Enviado com sucesso"
  },
  "actions": {
    "replace": "Substituir"
  },
  "errors": {
    "TYPE_NOT_ALLOWED": "Tipo de arquivo não permitido",
    "TOO_LARGE": "Arquivo muito grande (máximo {{max}})",
    "DIMENSIONS_TOO_LARGE": "Imagem muito grande (máximo {{maxWidth}}x{{maxHeight}})",
    "EMPTY_FILE": "Arquivo vazio",
    "permission": "Permissão negada. Habilite o acesso nas Configurações.",
    "canceled": "Envio cancelado",
    "timeout": "Tempo esgotado. Tente novamente.",
    "generic": "Não foi possível enviar. Tente novamente."
  }
}
```

> Adicione `"uploads"` em `NAMESPACES` e importe o JSON em `resources.ts` (ver [`I18N.md`](./I18N.md)).

---

## 12. Testes

Com `@testing-library/react-native` + jest. Mocke os pickers e o `putToS3`; use MSW para presign/notify.

### 12.1 Validação

```ts
import { validateUpload } from "@/lib/uploads/validate";

test("rejeita arquivo acima do limite", () => {
  const asset = { uri: "file:///x", name: "big.png", mimeType: "image/png", size: 3 * 1024 * 1024 };
  expect(validateUpload(asset, "avatar")?.code).toBe("TOO_LARGE"); // limite 2MB
});

test("rejeita mime não permitido", () => {
  const asset = { uri: "file:///x", name: "doc.exe", mimeType: "application/x-msdownload", size: 10 };
  expect(validateUpload(asset, "bookingAttachment")?.code).toBe("TYPE_NOT_ALLOWED");
});
```

### 12.2 Upload completo com MSW + pickers mockados

```ts
import { server } from "@/test/mocks/server";
import { http, HttpResponse } from "msw";
import { fireEvent, screen } from "@testing-library/react-native";

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
  launchImageLibraryAsync: async () => ({
    canceled: false,
    assets: [{ uri: "file:///photo.png", fileName: "photo.png", mimeType: "image/png", fileSize: 1024, width: 100, height: 100 }],
  }),
}));
jest.mock("@/lib/uploads/put-to-s3", () => ({ putToS3: jest.fn().mockResolvedValue(undefined) }));

test("happy path", async () => {
  server.use(
    http.post("*/v1/uploads/presign", () =>
      HttpResponse.json({ url: "https://fake.s3/put", key: "uploads/abc.png", expiresAt: "..." }),
    ),
    http.post("*/v1/bookings/:id/attachments", () =>
      HttpResponse.json({ id: "att_1", key: "uploads/abc.png" }),
    ),
  );

  renderWithProviders(<MyFormUsingPicker />);
  fireEvent.press(screen.getByText(/galeria/i));

  expect(await screen.findByText(/enviado com sucesso/i)).toBeTruthy();
});
```

### 12.3 Cancel

Teste `useFileUpload` com `putToS3` mockado que respeita o `signal` (rejeita com `AbortError` ao cancelar), e verifique que o estado vira `{ kind: "canceled" }`.

---

## 13. Checklist de upload

- [ ] Pick via `expo-image-picker` (câmera/galeria) ou `expo-document-picker`
- [ ] Permissões pedidas antes (media library / camera) + UX pra permissão negada (`Linking.openSettings`)
- [ ] Strings de permissão no `app.json` (plugin do expo-image-picker)
- [ ] Validação no app antes do presign (size, mime, dimensão do asset)
- [ ] Mesma constraint replicada no backend (revalidação)
- [ ] Content-Type idêntico em presign body e header do PUT
- [ ] PUT via `expo-file-system/legacy` (`BINARY_CONTENT` + `httpMethod: "PUT"`) para ter progresso, ou `fetch` para casos simples
- [ ] AbortController propagado (cancela a upload task nativa)
- [ ] Progress visível para arquivos > 1 MB; botão de cancel acessível
- [ ] Botão de retry após erro
- [ ] Preview via `expo-image` com o `file:// uri` (sem ObjectURL)
- [ ] i18n keys em `uploads.json` (+ namespace registrado)
- [ ] `crypto.randomUUID` → `expo-crypto` `randomUUID()`
- [ ] Lifecycle policy no S3 limpa `uploads/pending/` após 24h (backend)
- [ ] Teste cobre: happy path, validação falha, S3 falha, cancel, retry
