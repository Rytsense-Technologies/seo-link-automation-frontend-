import { ApiError } from "./errors";

/**
 * Browser-side HTTP client. Every call goes to the Next.js proxy, never straight to the backend,
 * so no API key or backend URL is needed here.
 *
 * `path` is the backend path without the /api prefix, e.g. "interlink/suggestions".
 * Options: `method` (default GET), `body` (serialised as JSON), `query` (undefined, null and ""
 * values are dropped) and `signal`.
 */

export const PROXY_BASE_PATH = "/api/backend";

export function buildProxyUrl(path, query) {
  const normalised = path.replace(/^\/+/, "");
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const search = params.toString();
  return `${PROXY_BASE_PATH}/${normalised}${search ? `?${search}` : ""}`;
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Performs the request and returns the parsed JSON, or throws an ApiError. */
export async function apiRequest(path, options = {}) {
  const { method = "GET", body, query, signal } = options;

  const init = {
    method,
    headers:
      body === undefined ? { accept: "application/json" } : { accept: "application/json", "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...(signal ? { signal } : {}),
  };

  let response;
  try {
    response = await fetch(buildProxyUrl(path, query), init);
  } catch (error) {
    // fetch only rejects when the request never completed (offline, aborted, DNS, ...).
    throw ApiError.networkError(error instanceof Error ? error.message : "The request could not be sent");
  }

  const payload = await readJson(response);
  if (!response.ok) throw ApiError.fromResponse(response.status, payload);
  return payload;
}
