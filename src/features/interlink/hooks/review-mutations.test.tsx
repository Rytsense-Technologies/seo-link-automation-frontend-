import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { QueryProvider } from "@/lib/query/query-provider";
import { DEFAULT_FILTERS } from "../lib/url-filters";
import { jsonResponse, makeSuggestionDetail, stubBackend, suggestionList } from "../testing/fixtures";
import { interlinkKeys } from "./query-keys";
import { approveSuggestion, useApproveSuggestion } from "./use-approve-suggestion";
import { reasonLength, rejectBody, rejectSuggestion, useRejectSuggestion } from "./use-reject-suggestion";

const ID = makeSuggestionDetail().id;
const BASE = `interlink/suggestions/${ID}`;
const LIST_KEY = interlinkKeys.suggestionList(DEFAULT_FILTERS);
const OTHER_DETAIL_KEY = interlinkKeys.suggestionDetail("99999999-9999-4999-8999-999999999999");

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A client holding this suggestion's detail, a list page and an unrelated detail. */
function seededClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(interlinkKeys.suggestionDetail(ID), makeSuggestionDetail());
  client.setQueryData(LIST_KEY, suggestionList([]));
  client.setQueryData(OTHER_DETAIL_KEY, makeSuggestionDetail());
  return client;
}

const wrapper = (client: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryProvider client={client}>{children}</QueryProvider>;
  };

const invalidated = (client: QueryClient, key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated;

const conflict = () =>
  jsonResponse(409, {
    error: { code: "INVALID_STATUS_TRANSITION", message: "Cannot change suggestion from APPROVED to APPROVED", details: { current_status: "APPROVED" } },
  });

describe("approveSuggestion", () => {
  it("POSTs to the approve endpoint through the BFF with no body", async () => {
    const api = stubBackend({ [`${BASE}/approve`]: () => jsonResponse(200, makeSuggestionDetail({ status: "APPROVED" })) });

    const result = await approveSuggestion(ID);

    expect(result.status).toBe("APPROVED");
    const [url, init] = api.fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/backend/${BASE}/approve`);
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).has("content-type")).toBe(false);
  });
});

describe("rejectSuggestion", () => {
  it("POSTs the trimmed reason", async () => {
    const api = stubBackend({ [`${BASE}/reject`]: () => jsonResponse(200, makeSuggestionDetail({ status: "REJECTED" })) });

    await rejectSuggestion(ID, "  Off-topic for this page.  ");

    const [url, init] = api.fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/backend/${BASE}/reject`);
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ reason: "Off-topic for this page." }));
  });

  it("sends an empty object when there is no reason", () => {
    expect(rejectBody(null)).toEqual({});
    expect(rejectBody("")).toEqual({});
    expect(rejectBody("   \n\t ")).toEqual({});
    expect(rejectBody(" keep inner  spacing ")).toEqual({ reason: "keep inner  spacing" });
  });

  it("counts the trimmed reason in code points, like the backend's maxLength", () => {
    expect(reasonLength("  abc  ")).toBe(3);
    expect(reasonLength("😀😀")).toBe(2);
    expect(reasonLength("   ")).toBe(0);
  });
});

describe.each([
  ["approve", (id: string) => useApproveSuggestion(id), undefined],
  ["reject", (id: string) => useRejectSuggestion(id), "reason"],
] as const)("use %s mutation", (action, useHook, variables) => {
  it("invalidates this suggestion's detail and every list on success, nothing else", async () => {
    stubBackend({ [`${BASE}/${action}`]: () => jsonResponse(200, makeSuggestionDetail()) });
    const client = seededClient();
    const { result } = renderHook(() => useHook(ID), { wrapper: wrapper(client) });

    await act(() => (result.current.mutateAsync as (v?: string) => Promise<unknown>)(variables));

    expect(invalidated(client, interlinkKeys.suggestionDetail(ID))).toBe(true);
    expect(invalidated(client, LIST_KEY)).toBe(true);
    expect(invalidated(client, OTHER_DETAIL_KEY)).toBe(false);
  });

  it("refreshes after a 409 conflict, since the status changed elsewhere", async () => {
    stubBackend({ [`${BASE}/${action}`]: conflict });
    const client = seededClient();
    const { result } = renderHook(() => useHook(ID), { wrapper: wrapper(client) });

    act(() => (result.current.mutate as (v?: string) => void)(variables));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidated(client, interlinkKeys.suggestionDetail(ID))).toBe(true);
    expect(invalidated(client, LIST_KEY)).toBe(true);
  });

  it("leaves the cache alone on other failures", async () => {
    stubBackend({ [`${BASE}/${action}`]: () => jsonResponse(503, { error: { code: "DATABASE_ERROR", message: "down" } }) });
    const client = seededClient();
    const { result } = renderHook(() => useHook(ID), { wrapper: wrapper(client) });

    act(() => (result.current.mutate as (v?: string) => void)(variables));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidated(client, interlinkKeys.suggestionDetail(ID))).toBe(false);
    expect(invalidated(client, LIST_KEY)).toBe(false);
  });
});
