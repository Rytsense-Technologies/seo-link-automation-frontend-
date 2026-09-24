import { vi } from "vitest";

/** Test-only fixtures shaped exactly like the backend contracts. Never imported by app code. */

export const SITE_A = "11111111-1111-4111-8111-111111111111";
export const SITE_B = "22222222-2222-4222-8222-222222222222";
export const PAGE_1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const PAGE_2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

export function makeSite(id, name) {
  return {
    id,
    name,
    base_url: `https://${name.toLowerCase()}.test/`,
    default_language: "en",
    default_region: null,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
  };
}

export function makePage(id, path, siteId = SITE_A) {
  return { id, site_id: siteId, url: `https://example.test${path}`, title: `Title ${path}`, h1: null };
}

export function makeSuggestion(overrides = {}) {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    site_id: SITE_A,
    source_page_id: PAGE_1,
    target_page_id: PAGE_2,
    target_url: "https://example.test/services/patient-engagement/",
    anchor_text: "patient engagement",
    context: "Our chatbots assist with scheduling and patient engagement, available anytime.",
    relevance_score: 55,
    reason: 'The source sentence already mentions "patient engagement".',
    status: "PENDING",
    created_at: "2026-09-22T14:11:04Z",
    updated_at: "2026-09-22T14:11:04Z",
    applied_at: null,
    ...overrides,
  };
}

export const SOURCE_PAGE = {
  id: PAGE_1,
  url: "https://example.test/healthcare-chatbots/",
  title: "Healthcare Chatbots | Example",
  h1: "Healthcare Chatbots",
};

export const TARGET_PAGE = {
  id: PAGE_2,
  url: "https://example.test/services/patient-engagement/",
  title: "Patient Engagement Services",
  h1: "Patient Engagement",
};

/** A deterministic (non-AI), unreviewed suggestion, as the detail endpoint returns it. */
export function makeSuggestionDetail(overrides = {}) {
  return {
    ...makeSuggestion(),
    retrieval_score: 0.5487,
    ai_provider: "deterministic",
    ai_model: null,
    rejection_reason: null,
    reviewed_at: null,
    source_page: SOURCE_PAGE,
    target_page: TARGET_PAGE,
    ...overrides,
  };
}

export function suggestionList(items, extra = {}) {
  return { items, total: items.length, page: 1, page_size: 20, ...extra };
}

export function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** What a stub handler sees of the request besides its query string. */

/**
 * A fetch stub that routes proxy requests by path (e.g. "interlink/suggestions") and records
 * every call, so tests can assert on the exact query, method and body the UI sent.
 * Each handler is called as `handler(searchParams, { method, body })`, where `body` is the parsed
 * JSON body or undefined, and returns a Response (or a promise of one).
 */
export function stubBackend(routes) {
  const fetchMock = vi.fn(async (input, init) => {
    const url = new URL(String(input), "http://localhost");
    const path = url.pathname.replace(/^\/api\/backend\//, "");
    const handler = routes[path];
    if (!handler) return jsonResponse(404, { error: { code: "NOT_FOUND", message: `No stub for ${path}` } });
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    return handler(url.searchParams, { method: init?.method ?? "GET", body });
  });
  vi.stubGlobal("fetch", fetchMock);

  const requests = (path) =>
    fetchMock.mock.calls
      .map(([input]) => new URL(String(input), "http://localhost"))
      .filter((url) => url.pathname === `/api/backend/${path}`)
      .map((url) => url.searchParams);

  /** Every call to `path` with its method and raw init, for mutation assertions. */
  const calls = (path) =>
    fetchMock.mock.calls
      .filter(([input]) => new URL(String(input), "http://localhost").pathname === `/api/backend/${path}`)
      .map(([, init]) => ({ method: init?.method ?? "GET", init }));

  return {
    fetchMock,
    requests,
    calls,
    lastRequest: (path) => requests(path).at(-1),
  };
}

export function pageList(items, extra = {}) {
  return { items, total: items.length, page: 1, page_size: 50, ...extra };
}
