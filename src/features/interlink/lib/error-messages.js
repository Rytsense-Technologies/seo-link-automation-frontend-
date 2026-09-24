import { isApiError } from "@/lib/api/errors";
import { INVALID_URL_MESSAGE } from "./page-url";

/**
 * Plain-language explanations for the backend's error codes (a string, or a function of the error
 * when the message depends on its details). The code itself is always shown too (see
 * `describeError`), so nothing the backend said is hidden from the reviewer.
 */
const ANALYSIS_MESSAGES = {
  INVALID_PAGE_URL: INVALID_URL_MESSAGE,
  SITE_NOT_FOUND: "This URL isn't on a website we have indexed.",
  PAGE_NOT_FOUND: "We couldn't find this page in the indexed website.",
  SOURCE_CONTENT_EMPTY: "This page doesn't contain enough usable content to generate internal-link suggestions.",
  NO_LINKABLE_CONTENT: "This page doesn't contain enough usable content to generate internal-link suggestions.",
  SOURCE_NOT_ANALYZABLE: "This page isn't a live page on your website, so it can't be analyzed.",
  // Crawling a page that is not indexed yet (POST /pages/discover).
  PAGE_HTTP_ERROR: (error) =>
    typeof error.details?.http_status === "number"
      ? `We couldn't access this page because it returned ${error.details.http_status}.`
      : "We couldn't access this page.",
  PAGE_BLOCKED_BY_ROBOTS: "This website's robots.txt doesn't allow this page to be crawled.",
  PAGE_URL_BLOCKED: "That URL can't be crawled by the system.",
  START_URL_BLOCKED: "That URL can't be crawled by the system.",
  START_URL_OUT_OF_SCOPE: "This URL isn't on a website we have indexed.",
  PAGE_NOT_HTML: "This URL isn't a web page, so it can't be analyzed.",
  PAGE_REDIRECTED: "This URL redirects to a page outside the indexed website, so it can't be analyzed.",
  PAGE_FETCH_FAILED: "We couldn't load this page (it may have timed out). Please try again.",
  PAGE_NOT_STORED: "We couldn't add this page to the index.",
  CRAWL_IN_PROGRESS: "A crawl of this website is already running. Try again when it has finished.",
};

const APPLY_MESSAGES = {
  SUGGESTION_NOT_APPROVED: "Only approved suggestions can be applied. Its current status has been refreshed.",
  INVALID_STATUS_TRANSITION: "This suggestion was already updated. Its current status has been refreshed.",
  ALREADY_LINKED: "The source page already links to this target page, so no new link was added.",
  TARGET_NOT_LINKABLE:
    "The target page can no longer be linked to (it may now redirect, be hidden from search engines, or return an error).",
  CONTENT_VERSION_CONFLICT:
    "The source page changed after this suggestion was generated. Refresh the suggestion and review it again before applying.",
  CONTEXT_NOT_FOUND:
    "The original sentence for this link is no longer on the source page, so the link can't be inserted where it was suggested.",
  ANCHOR_NOT_FOUND:
    "The anchor text is no longer in the original sentence on the source page, so the link can't be inserted where it was suggested.",
  ANCHOR_IN_UNSAFE_ELEMENT:
    "The anchor text is now inside a heading, menu, existing link or other area where a link can't be added safely.",
  SOURCE_PAGE_MISSING: "The source page no longer exists in the indexed website.",
  TARGET_PAGE_MISSING: "The target page no longer exists in the indexed website.",
};

const UNREACHABLE_MESSAGE = "We couldn't reach the analysis service. Please try again.";

/**
 * `{ message, code }` for an error from a request: a known code's explanation, the network
 * message when the backend could not be reached, otherwise the backend's own message.
 * `code` is "CODE · HTTP status" for API errors, null for anything else.
 */
export function describeError(error, messages = {}) {
  if (!isApiError(error)) {
    return { message: error instanceof Error && error.message ? error.message : "Something unexpected happened.", code: null };
  }
  const code = `${error.code} · HTTP ${error.status}`;
  const known = messages[error.code];
  if (known) return { message: typeof known === "function" ? known(error) : known, code };
  if (error.kind === "network" || error.kind === "unavailable") return { message: UNREACHABLE_MESSAGE, code };
  return { message: error.message, code };
}

export const describeAnalysisError = (error) => describeError(error, ANALYSIS_MESSAGES);
export const describeApplyError = (error) => describeError(error, APPLY_MESSAGES);
