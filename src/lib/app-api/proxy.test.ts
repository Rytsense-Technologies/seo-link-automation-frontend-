import { afterEach, describe, expect, it, vi } from "vitest";
import { proxyToBackend } from "./proxy";
import { BACKEND_UNAVAILABLE_CODE, BACKEND_UNAVAILABLE_STATUS, isBackendErrorBody } from "@/lib/api/errors";

const BACKEND = "http://127.0.0.1:8000";

const backendJson = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function stubFetch(response: Response | Error) {
  const mock = vi.fn(() => (response instanceof Error ? Promise.reject(response) : Promise.resolve(response)));
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("proxyToBackend", () => {
  it("forwards path and query to BACKEND_API_URL", async () => {
    vi.stubEnv("BACKEND_API_URL", BACKEND);
    vi.stubEnv("BACKEND_API_KEY", "");
    const fetchMock = stubFetch(backendJson(200, { items: [] }));

    const request = new Request("http://localhost:3000/api/backend/interlink/suggestions?status=PENDING&page=2");
    const response = await proxyToBackend(request, "/api/interlink/suggestions");

    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BACKEND}/api/interlink/suggestions?status=PENDING&page=2`);
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("attaches x-api-key only when configured, and never leaks it to the response", async () => {
    vi.stubEnv("BACKEND_API_URL", BACKEND);
    vi.stubEnv("BACKEND_API_KEY", "super-secret-key");
    const fetchMock = stubFetch(backendJson(200, { ok: true }));

    const response = await proxyToBackend(new Request("http://localhost:3000/api/backend/sites"), "/api/sites");

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get("x-api-key")).toBe("super-secret-key");
    expect([...response.headers.keys()]).not.toContain("x-api-key");
    expect(await response.text()).not.toContain("super-secret-key");
  });

  it("omits x-api-key when the backend runs without one", async () => {
    vi.stubEnv("BACKEND_API_URL", BACKEND);
    vi.stubEnv("BACKEND_API_KEY", "");
    const fetchMock = stubFetch(backendJson(200, {}));

    await proxyToBackend(new Request("http://localhost:3000/api/backend/sites"), "/api/sites");

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).has("x-api-key")).toBe(false);
  });

  it("forwards the request body and content type for mutations", async () => {
    vi.stubEnv("BACKEND_API_URL", BACKEND);
    const fetchMock = stubFetch(backendJson(200, { status: "APPROVED" }));

    const request = new Request("http://localhost:3000/api/backend/interlink/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source_page_id: "abc", use_ai: false }),
    });
    await proxyToBackend(request, "/api/interlink/analyze");

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ source_page_id: "abc", use_ai: false }));
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
  });

  it("preserves backend status and error payloads", async () => {
    vi.stubEnv("BACKEND_API_URL", BACKEND);
    const envelope = { error: { code: "INVALID_STATUS_TRANSITION", message: "Cannot change suggestion from APPLIED to REJECTED", details: null } };
    stubFetch(backendJson(409, envelope));

    const response = await proxyToBackend(new Request("http://localhost:3000/api/backend/x", { method: "POST" }), "/api/x");

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual(envelope);
  });

  it.each([404, 422, 502, 503])("passes status %i through untouched", async (status) => {
    vi.stubEnv("BACKEND_API_URL", BACKEND);
    stubFetch(backendJson(status, { error: { code: "X", message: "y" } }));

    const response = await proxyToBackend(new Request("http://localhost:3000/api/backend/x"), "/api/x");

    expect(response.status).toBe(status);
  });

  it("reports an unreachable backend as an error envelope", async () => {
    vi.stubEnv("BACKEND_API_URL", BACKEND);
    stubFetch(new TypeError("fetch failed"));

    const response = await proxyToBackend(new Request("http://localhost:3000/api/backend/sites"), "/api/sites");

    expect(response.status).toBe(BACKEND_UNAVAILABLE_STATUS);
    const body: unknown = await response.json();
    expect(isBackendErrorBody(body)).toBe(true);
    expect(isBackendErrorBody(body) && body.error.code).toBe(BACKEND_UNAVAILABLE_CODE);
  });

  it("fails clearly when BACKEND_API_URL is missing", async () => {
    vi.stubEnv("BACKEND_API_URL", "");
    const fetchMock = stubFetch(backendJson(200, {}));

    const response = await proxyToBackend(new Request("http://localhost:3000/api/backend/sites"), "/api/sites");

    expect(response.status).toBe(500);
    const body: unknown = await response.json();
    expect(isBackendErrorBody(body) && body.error.code).toBe("BACKEND_NOT_CONFIGURED");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
