import { env } from "@/env";
import { forceLogout, getJwtToken } from "@/lib/auth";
import { useHouseholdStore } from "@/stores/household-store";

// Custom fetch client consumed by all Kubb-generated hooks/clients. Injects the
// Bearer JWT and the active-household header, and force-logs-out on a hard 401.

export type RequestConfig<TData = unknown> = {
  method?: string;
  url?: string;
  baseURL?: string;
  params?: Record<string, unknown>;
  data?: TData;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export type ResponseConfig<TData = unknown> = {
  data: TData;
  status: number;
  statusText: string;
  headers?: Headers;
};

export type ResponseErrorConfig<TError = unknown> = TError;

export type Client = <TData = unknown, _TError = unknown, TVariables = unknown>(
  config: RequestConfig<TVariables>,
) => Promise<ResponseConfig<TData>>;

/** Typed API error carrying the backend error `code` (e.g. "HH-T0003"). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

function buildQuery(params?: Record<string, unknown>): string {
  if (!params) return "";
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) usp.append(key, String(value));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

const client: Client = async (config) => {
  const token = await getJwtToken();
  const householdId = useHouseholdStore.getState().activeHouseholdId;

  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(config.headers ?? {}),
  };
  if (token) headers.authorization = `Bearer ${token}`;
  if (householdId) headers["x-household-id"] = householdId;

  const url = `${config.baseURL ?? env.apiUrl}${config.url ?? ""}${buildQuery(config.params)}`;
  const res = await fetch(url, {
    method: (config.method ?? "GET").toUpperCase(),
    headers,
    body: config.data !== undefined ? JSON.stringify(config.data) : undefined,
    signal: config.signal,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    if (res.status === 401) await forceLogout();
    const body = data as { code?: string } | undefined;
    throw new ApiError(res.status, body?.code ?? `http_${res.status}`);
  }

  return {
    data: data as never,
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  };
};

export default client;
