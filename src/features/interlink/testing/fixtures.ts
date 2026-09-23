import { vi } from "vitest";
import type { PageList, PageRead } from "../types/pages";
import type { Site } from "../types/sites";
import type { Suggestion, SuggestionList } from "../types/suggestions";

/** Test-only fixtures shaped exactly like the backend contracts. Never imported by app code. */

export const SITE_A = "11111111-1111-4111-8111-111111111111";
export const SITE_B = "22222222-2222-4222-8222-222222222222";
export const PAGE_1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const PAGE_2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

export function makeSite(id: string, name: string): Site {
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

export function makePage(id: string, path: string, siteId = SITE_A): PageRead {
  return { id, site_id: siteId, url: `https://example.test${path}`, title: `Title ${path}`, h1: null };
}

export function makeSuggestion(overrides: Partial<Suggestion> = {}): Suggestion {
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

export function suggestionList(items: Suggestion[], extra: Partial<SuggestionList> = {}): SuggestionList {
  return { items, total: items.length, page: 1, page_size: 20, ...extra };
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

type Handler = (query: URLSearchParams) => Response | Promise<Response>;

/**
 * A fetch stub that routes proxy requests by path (e.g. "interlink/suggestions") and records
 * every call, so tests can assert on the exact query the UI sent.
 */
export function stubBackend(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    const path = url.pathname.replace(/^\/api\/backend\//, "");
    const handler = routes[path];
    if (!handler) return jsonResponse(404, { error: { code: "NOT_FOUND", message: `No stub for ${path}` } });
    return handler(url.searchParams);
  });
  vi.stubGlobal("fetch", fetchMock);

  const requests = (path: string): URLSearchParams[] =>
    fetchMock.mock.calls
      .map(([input]) => new URL(String(input), "http://localhost"))
      .filter((url) => url.pathname === `/api/backend/${path}`)
      .map((url) => url.searchParams);

  return {
    fetchMock,
    requests,
    lastRequest: (path: string): URLSearchParams | undefined => requests(path).at(-1),
  };
}

export function pageList(items: PageRead[], extra: Partial<PageList> = {}): PageList {
  return { items, total: items.length, page: 1, page_size: 50, ...extra };
}
