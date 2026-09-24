import { afterEach, describe, expect, it, vi } from "vitest";
import { PROXY_BASE_PATH, apiRequest, buildProxyUrl } from "./client";
import { ApiError } from "./errors";

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildProxyUrl", () => {
  it("targets the proxy, never the backend directly", () => {
    expect(buildProxyUrl("interlink/suggestions", undefined)).toBe(`${PROXY_BASE_PATH}/interlink/suggestions`);
    expect(buildProxyUrl("/interlink/suggestions", undefined)).toBe(`${PROXY_BASE_PATH}/interlink/suggestions`);
  });

  it("serialises query values and drops empty ones", () => {
    const url = buildProxyUrl("interlink/suggestions", {
      status: "PENDING",
      page: 2,
      page_size: 20,
      site_id: undefined,
      source_page_id: null,
      target_page_id: "",
      min_relevance_score: 0,
    });
    const query = new URL(url, "http://localhost").searchParams;
    expect(query.get("status")).toBe("PENDING");
    expect(query.get("page")).toBe("2");
    expect(query.get("page_size")).toBe("20");
    expect(query.get("min_relevance_score")).toBe("0");
    expect(query.has("site_id")).toBe(false);
    expect(query.has("source_page_id")).toBe(false);
    expect(query.has("target_page_id")).toBe(false);
  });
});

describe("apiRequest", () => {
  it("returns parsed JSON on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [], total: 0, page: 1, page_size: 20 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiRequest("interlink/suggestions", { query: { status: "PENDING" } });

    expect(result.total).toBe(0);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${PROXY_BASE_PATH}/interlink/suggestions?status=PENDING`);
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("sends JSON bodies for mutations", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { status: "REJECTED" }));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("interlink/suggestions/abc/reject", { method: "POST", body: { reason: "not relevant" } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ reason: "not relevant" }));
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
  });

  it("throws an ApiError carrying the backend code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(409, { error: { code: "ALREADY_LINKED", message: "Source page already links to the target" } })),
    );

    const error = await apiRequest("interlink/suggestions/abc/apply", { method: "POST" }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("ALREADY_LINKED");
    expect(error.kind).toBe("conflict");
  });

  it("turns a failed fetch into a network ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const error = await apiRequest("interlink/suggestions").catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe("network");
  });

  it("tolerates an empty body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    await expect(apiRequest("interlink/suggestions")).resolves.toBeNull();
  });
});
