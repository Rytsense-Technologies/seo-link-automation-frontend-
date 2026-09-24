import "server-only";

/**
 * Server-only backend configuration. Importing this from a Client Component is a build error
 * (see `server-only`), which is what keeps BACKEND_API_KEY out of the browser bundle.
 */

export class BackendConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "BackendConfigError";
  }
}

/**
 * Returns `{ baseUrl, apiKey }`: the backend URL without a trailing slash, and the key sent as
 * x-api-key (null when the backend runs without API_KEY).
 */
export function readBackendConfig(env = process.env) {
  const baseUrl = env.BACKEND_API_URL?.trim();
  if (!baseUrl) {
    throw new BackendConfigError("BACKEND_API_URL is not set (see .env.example)");
  }
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new BackendConfigError(`BACKEND_API_URL is not a valid URL: ${baseUrl}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new BackendConfigError(`BACKEND_API_URL must be http(s): ${baseUrl}`);
  }
  const apiKey = env.BACKEND_API_KEY?.trim();
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey: apiKey ? apiKey : null };
}

/** Absolute backend URL for an /api path, preserving the query string. */
export function backendUrl(config, path, search = "") {
  const normalised = path.startsWith("/") ? path : `/${path}`;
  return `${config.baseUrl}${normalised}${search}`;
}
