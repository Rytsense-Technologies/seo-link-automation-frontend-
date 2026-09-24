/**
 * HTTP Basic Auth gate for the whole app (pages and the /api/backend proxy). The app has no user
 * accounts, and the proxy can approve, reject and apply links, so a deployed instance must not be
 * open to anyone who finds its URL.
 *
 * Configured with BASIC_AUTH_USER / BASIC_AUTH_PASSWORD (server-only; never NEXT_PUBLIC_).
 * - Both set: every request needs those credentials.
 * - Neither set: allowed in development only. In production the app refuses to serve (503)
 *   instead of silently running unprotected.
 * - Only one set: treated as a misconfiguration (503), never as "open".
 *
 * Web-standard APIs only (atob, TextEncoder, Web Crypto): hosts such as Netlify run the proxy
 * as an edge function, where Node built-ins like Buffer are not guaranteed.
 */

export const REALM = "SEO Link Automation";

export function readAuthConfig(env = process.env) {
  const user = env.BASIC_AUTH_USER ?? "";
  const password = env.BASIC_AUTH_PASSWORD ?? "";
  if (user && password) return { mode: "protected", user, password };
  if (!user && !password && env.NODE_ENV !== "production") return { mode: "open" };
  return { mode: "misconfigured" };
}

/** Constant-time string comparison: both sides are hashed, so lengths and early exits leak nothing. */
async function safeEqual(a, b) {
  const encoder = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const left = new Uint8Array(x);
  const right = new Uint8Array(y);
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) difference |= left[i] ^ right[i];
  return difference === 0;
}

/** Decodes the "user:password" part of a Basic header as UTF-8, or null when it is malformed. */
function decodeBasic(authorization) {
  if (!authorization?.startsWith("Basic ")) return null;
  try {
    const binary = atob(authorization.slice(6).trim());
    return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
  } catch {
    return null;
  }
}

/** True when an Authorization header carries exactly the configured credentials. */
export async function hasValidCredentials(authorization, { user, password }) {
  const decoded = decodeBasic(authorization);
  const separator = decoded?.indexOf(":") ?? -1;
  if (separator < 0) return false;
  const [userOk, passwordOk] = await Promise.all([
    safeEqual(decoded.slice(0, separator), user),
    safeEqual(decoded.slice(separator + 1), password),
  ]);
  return userOk && passwordOk;
}

/**
 * The response to send instead of the page, or null to let the request through.
 * `authorization` is the request's Authorization header.
 */
export async function authResponse(authorization, env = process.env) {
  const config = readAuthConfig(env);
  if (config.mode === "open") return null;
  if (config.mode === "misconfigured") {
    return new Response("Access protection is not configured (set BASIC_AUTH_USER and BASIC_AUTH_PASSWORD).", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  if (await hasValidCredentials(authorization, config)) return null;
  return new Response("Authentication required.", {
    status: 401,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "www-authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
    },
  });
}
