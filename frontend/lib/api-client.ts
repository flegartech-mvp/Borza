import { getApiConfig } from "./runtime-config";
import { getSupabaseBrowserClient } from "./supabase-client";

export class AcademyApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly detail?: string,
  ) {
    super(message);
    this.name = "AcademyApiError";
  }
}

type RequestOptions = Omit<RequestInit, "headers" | "body"> & {
  body?: unknown;
  headers?: Record<string, string>;
};

async function accessToken(): Promise<string | null> {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function academyApi<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const api = getApiConfig();
  if (api.value === null) throw new AcademyApiError("Academy API is not configured.", undefined, api.issue ?? undefined);
  const token = await accessToken();
  const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(`${api.value}/api/v1${path.startsWith("/") ? path : `/${path}`}`, {
      ...options,
      cache: "no-store",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    throw new AcademyApiError("Academy API could not be reached.", undefined, error instanceof Error ? error.message : undefined);
  }
  if (!response.ok) {
    let detail: string | undefined;
    try {
      const payload = (await response.json()) as { detail?: unknown };
      detail = typeof payload.detail === "string" ? payload.detail : undefined;
    } catch {
      detail = undefined;
    }
    throw new AcademyApiError(`Academy API request failed (${response.status}).`, response.status, detail);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
