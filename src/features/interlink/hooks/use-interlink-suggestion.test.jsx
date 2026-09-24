import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { QueryProvider } from "@/lib/query/query-provider";
import { jsonResponse, makeSuggestionDetail } from "../testing/fixtures";
import { interlinkKeys } from "./query-keys";
import { fetchSuggestion, suggestionDetailPath, useInterlinkSuggestion } from "./use-interlink-suggestion";

const ID = makeSuggestionDetail().id;

afterEach(() => {
  vi.unstubAllGlobals();
});

function wrapper(client) {
  return function Wrapper({ children }) {
    return <QueryProvider client={client}>{children}</QueryProvider>;
  };
}

describe("suggestion detail query", () => {
  it("targets the detail endpoint through the BFF", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, makeSuggestionDetail()));
    vi.stubGlobal("fetch", fetchMock);

    await fetchSuggestion(ID);

    expect(suggestionDetailPath(ID)).toBe(`interlink/suggestions/${ID}`);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`/api/backend/interlink/suggestions/${ID}`);
    expect(init.method).toBe("GET");
  });

  it("caches under the existing interlink suggestions key hierarchy", () => {
    const key = interlinkKeys.suggestionDetail(ID);
    expect(key).toEqual(["interlink", "suggestions", "detail", ID]);
    expect(key.slice(0, 2)).toEqual(interlinkKeys.suggestions());
    expect(interlinkKeys.suggestionLists().slice(0, 2)).toEqual(interlinkKeys.suggestions());
  });

  it("loads the suggestion into the detail key", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, makeSuggestionDetail())));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useInterlinkSuggestion(ID), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.ai_provider).toBe("deterministic");
    expect(client.getQueryData(interlinkKeys.suggestionDetail(ID))).toEqual(makeSuggestionDetail());
  });

  it("never sends an id that is not a UUID", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient();

    const { result } = renderHook(() => useInterlinkSuggestion("not-a-uuid"), { wrapper: wrapper(client) });

    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
