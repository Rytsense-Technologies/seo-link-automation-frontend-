import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FILTERS } from "../lib/url-filters";
import { PAGE_1, SITE_A, jsonResponse, suggestionList } from "../testing/fixtures";
import { interlinkKeys } from "./query-keys";
import { fetchSuggestions } from "./use-interlink-suggestions";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch() {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, suggestionList([])));
  vi.stubGlobal("fetch", fetchMock);
  return () => new URL(String(fetchMock.mock.calls[0]?.[0]), "http://localhost");
}

describe("fetchSuggestions", () => {
  it("calls the list endpoint through the BFF with only pagination by default", async () => {
    const requestedUrl = stubFetch();
    await fetchSuggestions(DEFAULT_FILTERS);
    const url = requestedUrl();
    expect(url.pathname).toBe("/api/backend/interlink/suggestions");
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: "1", page_size: "20" });
  });

  it("sends every active filter under the backend's parameter names", async () => {
    const requestedUrl = stubFetch();
    await fetchSuggestions({
      status: "APPROVED",
      site_id: SITE_A,
      source_page_id: PAGE_1,
      min_relevance_score: 40,
      page: 3,
      page_size: 50,
    });
    expect(Object.fromEntries(requestedUrl().searchParams)).toEqual({
      status: "APPROVED",
      site_id: SITE_A,
      source_page_id: PAGE_1,
      min_relevance_score: "40",
      page: "3",
      page_size: "50",
    });
  });

  it("keeps a minimum score of 0, which is a real filter", async () => {
    const requestedUrl = stubFetch();
    await fetchSuggestions({ ...DEFAULT_FILTERS, min_relevance_score: 0 });
    expect(requestedUrl().searchParams.get("min_relevance_score")).toBe("0");
  });
});

describe("interlinkKeys", () => {
  it("caches each filter combination separately under one invalidatable prefix", () => {
    const pending = interlinkKeys.suggestionList({ ...DEFAULT_FILTERS, status: "PENDING" });
    const page2 = interlinkKeys.suggestionList({ ...DEFAULT_FILTERS, page: 2 });
    expect(pending).not.toEqual(page2);
    expect(pending.slice(0, 3)).toEqual(interlinkKeys.suggestionLists());
    expect(page2.slice(0, 3)).toEqual(interlinkKeys.suggestionLists());
  });
});
