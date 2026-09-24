/** The longest page URL the backend accepts (`GET /api/pages/resolve`, `url` maxLength). */
export const MAX_PAGE_URL_LENGTH = 2048;

export const INVALID_URL_MESSAGE = "Enter a valid HTTP or HTTPS URL.";
export const EMPTY_URL_MESSAGE = "Enter the URL of a page on your website.";

/**
 * Checks a URL typed by the reviewer before anything is sent: trimmed, absolute, http(s), with a
 * host. Returns `{ url }` (the trimmed URL, otherwise unchanged; the backend normalises it) or
 * `{ error }` with a message for the form.
 */
export function validatePageUrl(input) {
  const url = (input ?? "").trim();
  if (!url) return { error: EMPTY_URL_MESSAGE };
  if (url.length > MAX_PAGE_URL_LENGTH) return { error: INVALID_URL_MESSAGE };
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { error: INVALID_URL_MESSAGE };
  }
  if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || !parsed.hostname) {
    return { error: INVALID_URL_MESSAGE };
  }
  return { url };
}
