import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { QueryProvider } from "@/lib/query/query-provider";
import { InterlinkPlaceholder } from "./interlink-placeholder";

/** A client that fails fast, so error paths are not retried in tests. */
const testClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const renderPlaceholder = () =>
  render(
    <QueryProvider client={testClient()}>
      <InterlinkPlaceholder />
    </QueryProvider>,
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe("InterlinkPlaceholder", () => {
  it("renders the review workspace heading", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("[]", { status: 200, headers: { "content-type": "application/json" } })));
    renderPlaceholder();
    expect(screen.getByRole("heading", { name: "Review workspace" })).toBeInTheDocument();
  });

  it("reports a connected backend once the query resolves", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("[]", { status: 200, headers: { "content-type": "application/json" } })));
    renderPlaceholder();
    expect(screen.getByText("Checking backend…")).toBeInTheDocument();
    expect(await screen.findByText("Backend connected")).toBeInTheDocument();
  });

  it("surfaces the backend error code when the backend is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    renderPlaceholder();
    expect(await screen.findByText(/Backend unavailable: BACKEND_UNAVAILABLE/)).toBeInTheDocument();
  });

  it("surfaces a backend error envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: "DATABASE_ERROR", message: "A database error occurred" } }), {
          status: 503,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    renderPlaceholder();
    expect(await screen.findByText(/Backend unavailable: DATABASE_ERROR \(503\)/)).toBeInTheDocument();
  });
});
