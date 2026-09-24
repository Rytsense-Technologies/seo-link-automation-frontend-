import "server-only";

import { BackendConfigError, backendUrl, readBackendConfig } from "./backend-config";
import { BACKEND_UNAVAILABLE_CODE, BACKEND_UNAVAILABLE_STATUS } from "@/lib/api/errors";

/**
 * Forwards a browser request to the Fastify backend.
 *
 * - the backend's status code and JSON body are passed through untouched, so the client keeps the
 *   real error codes (INVALID_STATUS_TRANSITION, ALREADY_LINKED, ...)
 * - x-api-key is attached here, on the server, and never reaches client JavaScript
 * - a backend that is down produces a normal error envelope instead of an unhandled exception
 */

/** Request headers worth forwarding; everything else (cookies, host, auth) is dropped. */
const FORWARDED_REQUEST_HEADERS = ["content-type", "accept"];

const errorBody = (code, message, details) => ({
  error: { code, message, ...(details === undefined ? {} : { details }) },
});

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/**
 * `options.timeoutMs` aborts the backend call after that many ms. Analyze runs can be slow, so the
 * default is generous.
 */
export async function proxyToBackend(request, path, options = {}) {
  const { timeoutMs = 120_000 } = options;

  let config;
  try {
    config = readBackendConfig();
  } catch (error) {
    if (error instanceof BackendConfigError) {
      // A misconfigured server, not a failed backend call.
      return jsonResponse(500, errorBody("BACKEND_NOT_CONFIGURED", error.message));
    }
    throw error;
  }

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (config.apiKey) headers.set("x-api-key", config.apiKey);

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const search = new URL(request.url).search;

  const init = {
    method,
    headers,
    ...(hasBody ? { body: await request.text() } : {}),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
    redirect: "manual",
  };

  let response;
  try {
    response = await fetch(backendUrl(config, path, search), init);
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "TimeoutError";
    return jsonResponse(
      BACKEND_UNAVAILABLE_STATUS,
      errorBody(
        BACKEND_UNAVAILABLE_CODE,
        aborted ? `The backend did not respond within ${timeoutMs} ms` : "The backend is unreachable",
      ),
    );
  }

  // Pass the backend's own status and payload through unchanged.
  const body = await response.text();
  const contentType = response.headers.get("content-type") ?? "application/json";
  return new Response(body.length ? body : null, {
    status: response.status,
    headers: { "content-type": contentType, "cache-control": "no-store" },
  });
}
