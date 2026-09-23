import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient } from "@tanstack/react-query";
import { QueryProvider } from "@/lib/query/query-provider";
import {
  PAGE_1,
  PAGE_2,
  SITE_A,
  SITE_B,
  jsonResponse,
  makePage,
  makeSite,
  makeSuggestion,
  pageList,
  stubBackend,
  suggestionList,
} from "../testing/fixtures";
import { goBack, setTestUrl } from "../testing/next-navigation-mock";
import { InterlinkPage } from "./interlink-page";

vi.mock("next/navigation", () => import("../testing/next-navigation-mock"));

const SUGGESTIONS = "interlink/suggestions";

/** Mirrors the shared defaults that matter here (no retries, no focus refetch), minus retry delays. */
const testClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });

function renderPage() {
  const user = userEvent.setup();
  render(
    <QueryProvider client={testClient()}>
      <InterlinkPage />
    </QueryProvider>,
  );
  return user;
}

const search = () => new URLSearchParams(window.location.search);

function backend(overrides: { suggestions?: (query: URLSearchParams) => Response | Promise<Response> } = {}) {
  return stubBackend({
    sites: () => jsonResponse(200, [makeSite(SITE_A, "Alpha"), makeSite(SITE_B, "Beta")]),
    pages: (query) =>
      jsonResponse(
        200,
        query.get("page") === "2"
          ? pageList([makePage(PAGE_2, "/services/")], { page: 2, total: 51 })
          : pageList([makePage(PAGE_1, "/blog/")], { total: 51 }),
      ),
    [SUGGESTIONS]:
      overrides.suggestions ??
      ((query) =>
        jsonResponse(
          200,
          suggestionList([makeSuggestion({ anchor_text: `anchor for ${query.get("status") ?? "all"}` })], {
            page: Number(query.get("page")),
            page_size: Number(query.get("page_size")),
            total: 45,
          }),
        )),
  });
}

beforeEach(() => {
  setTestUrl("/interlink");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("InterlinkPage", () => {
  it("shows skeletons first, then the suggestions from the backend", async () => {
    const api = backend();
    renderPage();
    expect(screen.getByRole("status", { name: "Loading suggestions" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "anchor for all" })).toBeInTheDocument();
    expect(Object.fromEntries(api.lastRequest(SUGGESTIONS) ?? [])).toEqual({ page: "1", page_size: "20" });
  });

  it("links each card's target URL from the list response, with no per-card page request", async () => {
    const api = backend();
    renderPage();
    await screen.findByRole("heading", { name: "anchor for all" });

    const link = screen.getByRole("link", { name: /opens in a new tab/ });
    expect(link).toHaveAttribute("href", makeSuggestion().target_url);
    const paths = api.fetchMock.mock.calls.map(([input]) => new URL(String(input), "http://localhost").pathname);
    expect(new Set(paths)).toEqual(new Set(["/api/backend/sites", "/api/backend/interlink/suggestions"]));
  });

  it("links each card to its detail page, carrying the current filters", async () => {
    setTestUrl(`/interlink?status=PENDING&site_id=${SITE_A}&page=2`);
    backend();
    renderPage();
    const card = await screen.findByRole("link", { name: "anchor for PENDING" });
    expect(card).toHaveAttribute("href", `/interlink/${makeSuggestion().id}?status=PENDING&site_id=${SITE_A}&page=2`);
  });

  it("does not load any site pages until a site is chosen", async () => {
    const api = backend();
    renderPage();
    await screen.findByRole("heading", { name: "anchor for all" });
    expect(api.requests("pages")).toHaveLength(0);
    expect(screen.getByLabelText("Source page")).toBeDisabled();
  });

  describe("status filter", () => {
    it("writes the status to the URL and queries the backend with it", async () => {
      const api = backend();
      const user = renderPage();
      await screen.findByRole("heading", { name: "anchor for all" });

      await user.selectOptions(screen.getByLabelText("Status"), "APPROVED");

      expect(search().get("status")).toBe("APPROVED");
      expect(await screen.findByRole("heading", { name: "anchor for APPROVED" })).toBeInTheDocument();
      expect(api.lastRequest(SUGGESTIONS)?.get("status")).toBe("APPROVED");
    });

    it("offers All and the four backend statuses", async () => {
      backend();
      renderPage();
      const options = within(screen.getByLabelText("Status")).getAllByRole("option");
      expect(options.map((option) => option.textContent)).toEqual(["All", "PENDING", "APPROVED", "REJECTED", "APPLIED"]);
    });
  });

  describe("site filter", () => {
    it("lists the sites returned by /api/sites and filters by the chosen one", async () => {
      const api = backend();
      const user = renderPage();
      const siteSelect = screen.getByLabelText("Site");
      await within(siteSelect).findByRole("option", { name: "Beta" });

      await user.selectOptions(siteSelect, SITE_B);

      expect(search().get("site_id")).toBe(SITE_B);
      await waitFor(() => expect(api.lastRequest(SUGGESTIONS)?.get("site_id")).toBe(SITE_B));
    });

    it("clears the source page when the site changes", async () => {
      setTestUrl(`/interlink?site_id=${SITE_A}&source_page_id=${PAGE_1}`);
      backend();
      const user = renderPage();
      const siteSelect = screen.getByLabelText("Site");
      await within(siteSelect).findByRole("option", { name: "Beta" });

      await user.selectOptions(siteSelect, SITE_B);

      expect(search().get("site_id")).toBe(SITE_B);
      expect(search().has("source_page_id")).toBe(false);
    });
  });

  describe("source page filter", () => {
    it("loads the selected site's pages a batch at a time and filters by the chosen page", async () => {
      setTestUrl(`/interlink?site_id=${SITE_A}`);
      const api = backend();
      const user = renderPage();
      const sourceSelect = screen.getByLabelText("Source page");
      await within(sourceSelect).findByRole("option", { name: "/blog/" });

      expect(Object.fromEntries(api.lastRequest("pages") ?? [])).toEqual({ site_id: SITE_A, page: "1", page_size: "50" });
      expect(screen.getByText(/1 of 51 pages loaded/)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Load more pages" }));
      await within(sourceSelect).findByRole("option", { name: "/services/" });
      expect(api.lastRequest("pages")?.get("page")).toBe("2");

      await user.selectOptions(sourceSelect, PAGE_2);
      expect(search().get("source_page_id")).toBe(PAGE_2);
      await waitFor(() => expect(api.lastRequest(SUGGESTIONS)?.get("source_page_id")).toBe(PAGE_2));
      expect(api.lastRequest(SUGGESTIONS)?.get("site_id")).toBe(SITE_A);
    });

    it("keeps a source page from the URL selected even before its batch is loaded", async () => {
      setTestUrl(`/interlink?site_id=${SITE_A}&source_page_id=${PAGE_2}`);
      const api = backend();
      renderPage();
      expect(screen.getByLabelText("Source page")).toHaveValue(PAGE_2);
      await waitFor(() => expect(api.lastRequest(SUGGESTIONS)?.get("source_page_id")).toBe(PAGE_2));
    });
  });

  describe("minimum relevance score filter", () => {
    it("applies the score on Enter", async () => {
      const api = backend();
      const user = renderPage();
      await screen.findByRole("heading", { name: "anchor for all" });

      await user.type(screen.getByLabelText("Min. relevance score"), "40{Enter}");

      expect(search().get("min_relevance_score")).toBe("40");
      await waitFor(() => expect(api.lastRequest(SUGGESTIONS)?.get("min_relevance_score")).toBe("40"));
    });

    it("rejects values outside 0-100 without querying", async () => {
      const api = backend();
      const user = renderPage();
      await screen.findByRole("heading", { name: "anchor for all" });
      const input = screen.getByLabelText("Min. relevance score");

      await user.type(input, "150{Enter}");

      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByText("Enter a whole number from 0 to 100.")).toBeInTheDocument();
      expect(search().has("min_relevance_score")).toBe(false);
      expect(api.requests(SUGGESTIONS).every((query) => !query.has("min_relevance_score"))).toBe(true);
    });

    it("removes the filter when the input is cleared", async () => {
      setTestUrl("/interlink?min_relevance_score=40");
      backend();
      const user = renderPage();
      const input = screen.getByLabelText("Min. relevance score");
      expect(input).toHaveValue(40);

      await user.clear(input);
      await user.tab();

      expect(search().has("min_relevance_score")).toBe(false);
    });
  });

  describe("pagination", () => {
    it("moves through backend pages via the URL", async () => {
      const api = backend();
      const user = renderPage();
      await screen.findByText("Showing 1–1 of 45");

      await user.click(screen.getByRole("button", { name: "Next" }));

      expect(search().get("page")).toBe("2");
      expect(await screen.findByText("Showing 21–21 of 45")).toBeInTheDocument();
      expect(api.lastRequest(SUGGESTIONS)?.get("page")).toBe("2");
    });

    it("changes the page size and returns to page 1", async () => {
      setTestUrl("/interlink?page=2");
      const api = backend();
      const user = renderPage();
      await screen.findByText("Showing 21–21 of 45");

      await user.selectOptions(screen.getByLabelText("Per page"), "50");

      expect(search().get("page_size")).toBe("50");
      expect(search().has("page")).toBe(false);
      await waitFor(() => expect(Object.fromEntries(api.lastRequest(SUGGESTIONS) ?? [])).toEqual({ page: "1", page_size: "50" }));
    });
  });

  describe("empty state", () => {
    it("says nothing was found, without a clear action when unfiltered", async () => {
      backend({ suggestions: () => jsonResponse(200, suggestionList([])) });
      renderPage();
      expect(await screen.findByText("No interlink suggestions found.")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "Clear filters" })).toHaveLength(1); // the disabled one in the filter bar
      expect(screen.getByRole("button", { name: "Clear filters" })).toBeDisabled();
    });

    it("offers to clear active filters", async () => {
      setTestUrl(`/interlink?status=REJECTED&min_relevance_score=90&page_size=50`);
      backend({ suggestions: () => jsonResponse(200, suggestionList([])) });
      const user = renderPage();
      await screen.findByText("No interlink suggestions found.");

      const clearButtons = screen.getAllByRole("button", { name: "Clear filters" });
      expect(clearButtons).toHaveLength(2);
      await user.click(clearButtons[1]!);

      expect(window.location.search).toBe("?page_size=50");
    });
  });

  describe("error state", () => {
    it("shows the backend's message and code, and retries", async () => {
      let fail = true;
      const api = backend({
        suggestions: () =>
          fail
            ? jsonResponse(503, { error: { code: "DATABASE_ERROR", message: "A database error occurred" } })
            : jsonResponse(200, suggestionList([makeSuggestion({ anchor_text: "recovered" })])),
      });
      const user = renderPage();

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("A database error occurred");
      expect(alert).toHaveTextContent("DATABASE_ERROR · HTTP 503");

      fail = false;
      await user.click(within(alert).getByRole("button", { name: "Retry" }));

      expect(await screen.findByRole("heading", { name: "recovered" })).toBeInTheDocument();
      expect(api.requests(SUGGESTIONS)).toHaveLength(2);
    });

    it("reports an unreachable backend", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
      renderPage();
      expect(await screen.findByText(/BACKEND_UNAVAILABLE · HTTP 504/)).toBeInTheDocument();
    });
  });

  describe("URL state", () => {
    it("restores every filter from the URL on load (refresh / shared link)", async () => {
      setTestUrl(`/interlink?status=PENDING&site_id=${SITE_A}&source_page_id=${PAGE_1}&min_relevance_score=40&page=2&page_size=50`);
      const api = backend();
      renderPage();

      expect(screen.getByLabelText("Status")).toHaveValue("PENDING");
      expect(screen.getByLabelText("Site")).toHaveValue(SITE_A);
      expect(screen.getByLabelText("Source page")).toHaveValue(PAGE_1);
      expect(screen.getByLabelText("Min. relevance score")).toHaveValue(40);
      await waitFor(() =>
        expect(Object.fromEntries(api.lastRequest(SUGGESTIONS) ?? [])).toEqual({
          status: "PENDING",
          site_id: SITE_A,
          source_page_id: PAGE_1,
          min_relevance_score: "40",
          page: "2",
          page_size: "50",
        }),
      );
    });

    it("follows the browser back button", async () => {
      backend();
      const user = renderPage();
      await screen.findByRole("heading", { name: "anchor for all" });

      await user.selectOptions(screen.getByLabelText("Status"), "REJECTED");
      await screen.findByRole("heading", { name: "anchor for REJECTED" });

      await goBack();

      await waitFor(() => expect(screen.getByLabelText("Status")).toHaveValue(""));
      expect(await screen.findByRole("heading", { name: "anchor for all" })).toBeInTheDocument();
    });

    it("keeps the previous results on screen while a filter change loads", async () => {
      let release: () => void = () => undefined;
      backend({
        suggestions: (query) => {
          const body = jsonResponse(200, suggestionList([makeSuggestion({ anchor_text: `anchor for ${query.get("status") ?? "all"}` })]));
          if (!query.has("status")) return body;
          return new Promise<Response>((resolve) => {
            release = () => resolve(body);
          });
        },
      });
      const user = renderPage();
      await screen.findByRole("heading", { name: "anchor for all" });

      await user.selectOptions(screen.getByLabelText("Status"), "APPLIED");

      expect(await screen.findByText("Updating results…")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "anchor for all" })).toBeInTheDocument();
      expect(screen.queryByRole("status", { name: "Loading suggestions" })).not.toBeInTheDocument();
      release();
      expect(await screen.findByRole("heading", { name: "anchor for APPLIED" })).toBeInTheDocument();
    });
  });
});
