import { ApiError } from "./errors";

/**
 * Browser-side HTTP client. Every call goes to the Next.js proxy, never straight to the backend,
 * so no API key or backend URL is needed here.
 *
 * `path` is the backend path without the /api prefix, e.g. "interlink/suggestions".
 */

export const PROXY_BASE_PATH = "/api/backend";

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Serialised as JSON. */
  body?: unknown;
  /** Undefined and null values are dropped. */
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
}

export function buildProxyUrl(path: string, query: RequestOptions["query"]): string {
  const normalised = path.replace(/^\/+/, "");
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const search = params.toString();
  return `${PROXY_BASE_PATH}/${normalised}${search ? `?${search}` : ""}`;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** Performs the request and returns the parsed JSON, or throws an ApiError. */
export async function apiRequest<TResponse>(path: string, options: RequestOptions = {}): Promise<TResponse> {
  const { method = "GET", body, query, signal } = options;

  const init: RequestInit = {
    method,
    headers:
      body === undefined ? { accept: "application/json" } : { accept: "application/json", "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...(signal ? { signal } : {}),
  };

  let response: Response;
  try {
    response = await fetch(buildProxyUrl(path, query), init);
  } catch (error) {
    // fetch only rejects when the request never completed (offline, aborted, DNS, ...).
    throw ApiError.networkError(error instanceof Error ? error.message : "The request could not be sent");
  }

  const payload = await readJson(response);
  if (!response.ok) throw ApiError.fromResponse(response.status, payload);
  return payload as TResponse;
}
