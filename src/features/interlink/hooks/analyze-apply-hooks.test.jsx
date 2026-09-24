import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { QueryProvider } from "@/lib/query/query-provider";
import { DEFAULT_FILTERS } from "../lib/url-filters";
import { PAGE_1, SITE_A, jsonResponse, makeSite, makeSuggestionDetail, stubBackend, suggestionList } from "../testing/fixtures";
import { interlinkKeys } from "./query-keys";
import { analyzePage, analyzeRequestBody, resolvePage, useAnalyzePage } from "./use-analyze-page";
import { applySuggestion, useApplySuggestion } from "./use-apply-suggestion";

const PAGE_URL = "https://example.test/healthcare-chatbots/";
const RESOLVED = { site: makeSite(SITE_A, "Example"), page: { id: PAGE_1, site_id: SITE_A, url: PAGE_URL, title: "Healthcare Chatbots", h1: "Chatbots" } };
const ANALYSIS = { source_page_id: PAGE_1, generation_mode: "ai", ai_error: null, suggestions: [makeSuggestionDetail()] };
const ID = makeSuggestionDetail().id;

afterEach(() => {
  vi.unstubAllGlobals();
});

const wrapper = (client) =>
  function Wrapper({ children }) {
    return <QueryProvider client={client}>{children}</QueryProvider>;
  };
const invalidated = (client, key) => client.getQueryState(key)?.isInvalidated;

describe("analysis requests", () => {
  it("resolves a URL through the BFF with a GET and the URL as a query parameter", async () => {
    const api = stubBackend({ "pages/resolve": () => jsonResponse(200, RESOLVED) });
    expect(await resolvePage(PAGE_URL)).toEqual(RESOLVED);
    const [url, init] = api.fetchMock.mock.calls[0];
    expect(url).toBe(`/api/backend/pages/resolve?url=${encodeURIComponent(PAGE_URL)}`);
    expect(init.method).toBe("GET");
  });

  it("analyzes by page id, asking for AI scoring with the deterministic fallback", async () => {
    const api = stubBackend({ "interlink/analyze": () => jsonResponse(200, ANALYSIS) });
    await analyzePage(PAGE_1);
    const [url, init] = api.fetchMock.mock.calls[0];
    expect(url).toBe("/api/backend/interlink/analyze");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ source_page_id: PAGE_1, use_ai: true, ai_fallback: true });
    expect(analyzeRequestBody(PAGE_1)).not.toHaveProperty("dry_run");
  });
});

describe("useAnalyzePage", () => {
  it("resolves, then analyzes, reporting each stage, and caches both results", async () => {
    const api = stubBackend({
      "pages/resolve": () => jsonResponse(200, RESOLVED),
      "interlink/analyze": () => jsonResponse(200, ANALYSIS),
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(interlinkKeys.suggestionList(DEFAULT_FILTERS), suggestionList([]));
    const stages = [];
    const { result } = renderHook(() => useAnalyzePage({ onStage: (stage) => stages.push(stage) }), { wrapper: wrapper(client) });

    await act(() => result.current.mutateAsync({ url: PAGE_URL }));

    expect(stages).toEqual(["checking", "analyzing"]);
    expect(api.fetchMock.mock.calls.map(([url]) => new URL(url, "http://x").pathname)).toEqual([
      "/api/backend/pages/resolve",
      "/api/backend/interlink/analyze",
    ]);
    expect(client.getQueryData(interlinkKeys.resolvedPage(PAGE_URL))).toEqual(RESOLVED);
    expect(client.getQueryData(interlinkKeys.analysis(PAGE_1))).toEqual(ANALYSIS);
    expect(invalidated(client, interlinkKeys.suggestionList(DEFAULT_FILTERS))).toBe(true);
  });

  it("does not analyze when the page cannot be found", async () => {
    const api = stubBackend({
      "pages/resolve": () => jsonResponse(404, { error: { code: "PAGE_NOT_FOUND", message: "Page not found in the indexed website", details: null } }),
      "interlink/analyze": () => jsonResponse(200, ANALYSIS),
    });
    const { result } = renderHook(() => useAnalyzePage(), { wrapper: wrapper(new QueryClient()) });

    act(() => result.current.mutate({ url: PAGE_URL }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error.code).toBe("PAGE_NOT_FOUND");
    expect(api.calls("interlink/analyze")).toHaveLength(0);
  });
});

describe("useApplySuggestion", () => {
  const seeded = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(interlinkKeys.suggestionDetail(ID), makeSuggestionDetail({ status: "APPROVED" }));
    client.setQueryData(interlinkKeys.suggestionList(DEFAULT_FILTERS), suggestionList([]));
    client.setQueryData(interlinkKeys.resolvedPage(PAGE_URL), RESOLVED);
    return client;
  };

  it("POSTs to the apply endpoint through the BFF with no body", async () => {
    const api = stubBackend({ [`interlink/suggestions/${ID}/apply`]: () => jsonResponse(200, makeSuggestionDetail({ status: "APPLIED" })) });
    await applySuggestion(ID);
    const [url, init] = api.fetchMock.mock.calls[0];
    expect(url).toBe(`/api/backend/interlink/suggestions/${ID}/apply`);
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
  });

  it("refreshes the suggestion, the lists and the resolved source page after applying", async () => {
    stubBackend({ [`interlink/suggestions/${ID}/apply`]: () => jsonResponse(200, makeSuggestionDetail({ status: "APPLIED" })) });
    const client = seeded();
    const { result } = renderHook(() => useApplySuggestion(ID), { wrapper: wrapper(client) });

    await act(() => result.current.mutateAsync());

    expect(invalidated(client, interlinkKeys.suggestionDetail(ID))).toBe(true);
    expect(invalidated(client, interlinkKeys.suggestionList(DEFAULT_FILTERS))).toBe(true);
    expect(invalidated(client, interlinkKeys.resolvedPage(PAGE_URL))).toBe(true);
  });

  it("refreshes the suggestion on a 409 and never retries", async () => {
    const api = stubBackend({
      [`interlink/suggestions/${ID}/apply`]: () =>
        jsonResponse(409, { error: { code: "CONTENT_VERSION_CONFLICT", message: "Content changed", details: null } }),
    });
    const client = seeded();
    const { result } = renderHook(() => useApplySuggestion(ID), { wrapper: wrapper(client) });

    act(() => result.current.mutate());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidated(client, interlinkKeys.suggestionDetail(ID))).toBe(true);
    expect(api.calls(`interlink/suggestions/${ID}/apply`)).toHaveLength(1);
  });

  it("leaves the cache alone when the content cannot take the link (422)", async () => {
    stubBackend({
      [`interlink/suggestions/${ID}/apply`]: () =>
        jsonResponse(422, { error: { code: "ANCHOR_NOT_FOUND", message: "Anchor not found", details: null } }),
    });
    const client = seeded();
    const { result } = renderHook(() => useApplySuggestion(ID), { wrapper: wrapper(client) });

    act(() => result.current.mutate());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidated(client, interlinkKeys.suggestionDetail(ID))).toBe(false);
  });
});
