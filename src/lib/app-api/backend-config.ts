import "server-only";

/**
 * Server-only backend configuration. Importing this from a Client Component is a build error
 * (see `server-only`), which is what keeps BACKEND_API_KEY out of the browser bundle.
 */

export interface BackendConfig {
  /** Base URL without a trailing slash. */
  baseUrl: string;
  /** Sent as x-api-key when the backend runs with API_KEY set. */
  apiKey: string | null;
}

export class BackendConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackendConfigError";
  }
}

export function readBackendConfig(env: NodeJS.ProcessEnv = process.env): BackendConfig {
  const baseUrl = env.BACKEND_API_URL?.trim();
  if (!baseUrl) {
    throw new BackendConfigError("BACKEND_API_URL is not set (see .env.example)");
  }
  let parsed: URL;
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
export function backendUrl(config: BackendConfig, path: string, search = ""): string {
  const normalised = path.startsWith("/") ? path : `/${path}`;
  return `${config.baseUrl}${normalised}${search}`;
}
