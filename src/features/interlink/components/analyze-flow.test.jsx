import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient } from "@tanstack/react-query";
import { QueryProvider } from "@/lib/query/query-provider";
import { PAGE_1, PAGE_2, SITE_A, jsonResponse, makeSite, makeSuggestion, stubBackend, suggestionList } from "../testing/fixtures";
import { setTestUrl } from "../testing/next-navigation-mock";
import { InterlinkPage } from "./interlink-page";

vi.mock("next/navigation", () => import("../testing/next-navigation-mock"));

const TYPED_URL = "  https://example.test/healthcare-chatbots  ";
const PAGE_URL = "https://example.test/healthcare-chatbots/";
const RESOLVED = {
  site: makeSite(SITE_A, "Example Health"),
  page: { id: PAGE_1, site_id: SITE_A, url: PAGE_URL, title: "Healthcare Chatbots | Example", h1: "Healthcare Chatbots", http_status: 200 },
};
const FOR_PAGE = [
  makeSuggestion({ id: "c1111111-1111-4111-8111-111111111111", anchor_text: "patient engagement", relevance_score: 82 }),
  makeSuggestion({
    id: "c2222222-2222-4222-8222-222222222222",
    anchor_text: "appointment booking",
    target_page_id: PAGE_2,
    target_url: "https://example.test/ai-appointment-booking/",
    relevance_score: 74,
  }),
];
const ANALYSIS = { source_page_id: PAGE_1, generation_mode: "ai", ai_error: null, suggestions: FOR_PAGE, candidates: [], skipped: [] };

const apiError = (status, code, message) => jsonResponse(status, { error: { code, message, details: null } });

/** The fake backend. `analyze`/`resolve` can be replaced per test; list requests for the page return FOR_PAGE. */
function backend({ resolve, analyze, forPage = FOR_PAGE } = {}) {
  return stubBackend({
    sites: () => jsonResponse(200, [RESOLVED.site]),
    "pages/resolve": resolve ?? (() => jsonResponse(200, RESOLVED)),
    "interlink/analyze": analyze ?? (() => jsonResponse(200, ANALYSIS)),
    "interlink/suggestions": (query) =>
      jsonResponse(200, query.get("source_page_id") === PAGE_1 ? suggestionList(forPage, { page_size: 50 }) : suggestionList([])),
  });
}

function renderPage() {
  const user = userEvent.setup();
  render(
    // The app's own freshness window (30s), so a just-resolved page is not fetched again.
    <QueryProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30_000 } } })}
    >
      <InterlinkPage />
    </QueryProvider>,
  );
  return user;
}

const urlInput = () => screen.getByLabelText("Page URL");
const analyzeButton = () => screen.getByRole("button", { name: /Analyz/ });
const search = () => new URLSearchParams(window.location.search);
const analysisRegion = () => screen.findByRole("region", { name: "Analysis" });

function deferred() {
  let resolve = () => undefined;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  setTestUrl("/interlink");
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("URL input", () => {
  it("leads with a labelled URL field and an Analyze button, with no results yet", () => {
    backend();
    renderPage();
    expect(urlInput()).toHaveValue("");
    expect(analyzeButton()).toHaveTextContent("Analyze page");
    expect(screen.queryByRole("region", { name: "Analysis" })).not.toBeInTheDocument();
  });

  it("asks for a URL when submitted empty, without calling the backend", async () => {
    const api = backend();
    const user = renderPage();
    await user.click(analyzeButton());
    expect(screen.getByRole("alert")).toHaveTextContent("Enter the URL of a page on your website.");
    expect(urlInput()).toHaveAttribute("aria-invalid", "true");
    expect(api.calls("pages/resolve")).toHaveLength(0);
  });

  it("rejects a URL that is not absolute http(s), without calling the backend", async () => {
    const api = backend();
    const user = renderPage();
    await user.type(urlInput(), "example.test/healthcare-chatbots{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid HTTP or HTTPS URL.");
    expect(urlInput()).toHaveAccessibleDescription(expect.stringContaining("Enter a valid HTTP or HTTPS URL."));
    expect(api.calls("pages/resolve")).toHaveLength(0);

    await user.type(urlInput(), "x");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(); // cleared as soon as the reviewer edits
  });

  it("submits with Enter, trims the URL, and shows each real stage while it runs", async () => {
    const gate = deferred();
    const api = backend({
      analyze: async () => {
        await gate.promise;
        return jsonResponse(200, ANALYSIS);
      },
    });
    const user = renderPage();

    await user.type(urlInput(), `${TYPED_URL}{Enter}`);

    expect(await screen.findByText("Analyzing the page…")).toBeInTheDocument();
    expect(analyzeButton()).toHaveTextContent("Analyzing page…");
    expect(analyzeButton()).toBeDisabled();
    expect(urlInput()).toHaveValue(TYPED_URL.trim()); // kept (read-only) while analysis runs
    expect(urlInput()).toHaveAttribute("readonly");
    expect(api.requests("pages/resolve")[0].get("url")).toBe(TYPED_URL.trim());

    gate.resolve();
    await analysisRegion();
    // The field now shows the indexed page's URL, and the action offers a re-analysis of it.
    expect(urlInput()).toHaveValue(PAGE_URL);
    expect(analyzeButton()).toHaveTextContent("Analyze again");
    expect(urlInput()).toHaveAccessibleDescription("Re-analyze this page to find new internal-link opportunities.");
  });

  it("never sends a second analysis while one is running", async () => {
    const gate = deferred();
    const api = backend({
      analyze: async () => {
        await gate.promise;
        return jsonResponse(200, ANALYSIS);
      },
    });
    const user = renderPage();
    await user.type(urlInput(), PAGE_URL);

    await user.click(analyzeButton());
    await user.click(analyzeButton());
    fireEvent.submit(urlInput().closest("form"));
    fireEvent.submit(urlInput().closest("form"));
    gate.resolve();

    await analysisRegion();
    expect(api.calls("pages/resolve")).toHaveLength(1);
    expect(api.calls("interlink/analyze")).toHaveLength(1);
  });
});

describe("analysis results", () => {
  it("shows the source page and its suggested links, without exposing ids", async () => {
    const api = backend();
    const user = renderPage();
    await user.type(urlInput(), `${PAGE_URL}{Enter}`);
    const analysis = await analysisRegion();

    expect(search().get("url")).toBe(PAGE_URL);
    expect(JSON.parse(api.calls("interlink/analyze")[0].init.body)).toEqual({ source_page_id: PAGE_1, use_ai: true, ai_fallback: true });

    const source = within(analysis).getByRole("region", { name: "Source page" });
    expect(source).toHaveTextContent("Healthcare Chatbots | Example");
    expect(source).toHaveTextContent("Healthcare Chatbots");
    expect(source).toHaveTextContent("Example Health");
    expect(within(source).getByRole("link", { name: /opens in a new tab/ })).toHaveAttribute("href", PAGE_URL);

    const summary = await within(analysis).findByText("Analysis complete");
    expect(summary.parentElement).toHaveTextContent("2 new suggestions found.");
    expect(summary.parentElement).not.toHaveTextContent("already tracked"); // nothing existed before

    const cards = await within(analysis).findAllByRole("article");
    expect(cards).toHaveLength(2);
    const first = within(cards[0]);
    expect(first.getByRole("heading", { name: "patient engagement" })).toBeInTheDocument();
    expect(first.getByText("82%")).toBeInTheDocument();
    expect(first.getByRole("link", { name: /opens in a new tab/ })).toHaveAttribute("href", FOR_PAGE[0].target_url);
    expect(first.queryByText("Source")).not.toBeInTheDocument(); // the source is the page above
    expect(first.getByRole("link", { name: "Review suggestion: patient engagement" })).toHaveAttribute(
      "href",
      `/interlink/${FOR_PAGE[0].id}?url=${encodeURIComponent(PAGE_URL)}`,
    );
    expect(analysis).not.toHaveTextContent(PAGE_1);
    expect(analysis).not.toHaveTextContent(SITE_A);

    const listRequest = api.requests("interlink/suggestions").find((query) => query.get("source_page_id") === PAGE_1);
    expect(listRequest.get("site_id")).toBe(SITE_A);
  });

  it("says so when no opportunities were found", async () => {
    backend({ analyze: () => jsonResponse(200, { ...ANALYSIS, suggestions: [] }), forPage: [] });
    const user = renderPage();
    await user.type(urlInput(), `${PAGE_URL}{Enter}`);
    const analysis = await analysisRegion();

    expect(await within(analysis).findByText("No internal-link opportunities found.")).toBeInTheDocument();
    expect(within(analysis).getByText("We couldn't find suitable pages that meet the current relevance threshold.")).toBeInTheDocument();
    expect(within(analysis).queryAllByRole("article")).toHaveLength(0);
  });

  it("explains when AI scoring fell back to phrase matching", async () => {
    backend({ analyze: () => jsonResponse(200, { ...ANALYSIS, generation_mode: "deterministic_fallback", ai_error: "AI_PROVIDER_ERROR" }) });
    const user = renderPage();
    await user.type(urlInput(), `${PAGE_URL}{Enter}`);
    expect(await screen.findByText(/AI scoring was not available/)).toBeInTheDocument();
  });

  it("restores the analysed page from the address bar without analysing again", async () => {
    setTestUrl(`/interlink?url=${encodeURIComponent(PAGE_URL)}`);
    const api = backend();
    renderPage();
    const analysis = await analysisRegion();

    expect(await within(analysis).findAllByRole("article")).toHaveLength(2);
    expect(urlInput()).toHaveValue(PAGE_URL);
    expect(api.calls("interlink/analyze")).toHaveLength(0);
    expect(within(analysis).queryByText("Analysis complete")).not.toBeInTheDocument();
  });

  it("starts over with New analysis", async () => {
    setTestUrl(`/interlink?url=${encodeURIComponent(PAGE_URL)}&status=PENDING`);
    backend();
    const user = renderPage();
    const analysis = await analysisRegion();

    await user.click(within(analysis).getByRole("button", { name: "New analysis" }));

    expect(search().has("url")).toBe(false);
    expect(search().get("status")).toBe("PENDING"); // the history filters are left alone
    expect(screen.queryByRole("region", { name: "Analysis" })).not.toBeInTheDocument();
    expect(urlInput()).toHaveValue("");
  });
});

describe("analysis errors", () => {
  it.each([
    ["SITE_NOT_FOUND", 404, "resolve", "This URL isn't on a website we have indexed."],
    ["SOURCE_CONTENT_EMPTY", 422, "analyze", "This page doesn't contain enough usable content to generate internal-link suggestions."],
    ["NO_LINKABLE_CONTENT", 422, "analyze", "This page doesn't contain enough usable content to generate internal-link suggestions."],
    ["DATABASE_ERROR", 503, "analyze", "We couldn't reach the analysis service. Please try again."],
  ])("explains %s in plain language and keeps the code visible", async (code, status, step, message) => {
    const failing = () => apiError(status, code, "backend message");
    backend(step === "resolve" ? { resolve: failing } : { analyze: failing });
    const user = renderPage();
    await user.type(urlInput(), `${PAGE_URL}{Enter}`);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(message);
    expect(alert).toHaveTextContent(`${code} · HTTP ${status}`);
    expect(analyzeButton()).toBeEnabled();
    expect(urlInput()).toHaveValue(PAGE_URL);
    expect(search().has("url")).toBe(false);
  });

  it("reports an unreachable backend", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const user = renderPage();
    await user.type(urlInput(), `${PAGE_URL}{Enter}`);
    const panel = screen.getByRole("region", { name: "Analyze a page" });
    expect(await within(panel).findByRole("alert")).toHaveTextContent("We couldn't reach the analysis service. Please try again.");
  });

  it("explains a shared link to a page that is no longer indexed", async () => {
    setTestUrl(`/interlink?url=${encodeURIComponent(PAGE_URL)}`);
    backend({ resolve: () => apiError(404, "PAGE_NOT_FOUND", "Page not found in the indexed website") });
    renderPage();
    const analysis = await analysisRegion();
    expect(await within(analysis).findByRole("alert")).toHaveTextContent("We couldn't find this page in the indexed website.");
  });
});

describe("page structure", () => {
  it("keeps the suggestion history available below the analysis", async () => {
    backend();
    renderPage();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual(["Analyze a page", "Suggestion history"]);
    await waitFor(() => expect(screen.getByRole("region", { name: "Suggestion history" })).toBeInTheDocument());
  });

  it("folds the history away while an analysis is shown, loading nothing until it is opened", async () => {
    setTestUrl(`/interlink?url=${encodeURIComponent(PAGE_URL)}`);
    const api = backend();
    const user = renderPage();
    await analysisRegion();

    const history = screen.getByRole("region", { name: "Suggestion history" });
    expect(within(history).queryByRole("region", { name: "Filter suggestions" })).not.toBeInTheDocument();
    expect(api.requests("sites")).toHaveLength(0);
    expect(api.requests("interlink/suggestions").every((query) => query.get("source_page_id") === PAGE_1)).toBe(true);

    await user.click(within(history).getByRole("button", { name: "Show suggestion history" }));
    expect(await screen.findByRole("region", { name: "Filter suggestions" })).toBeInTheDocument();
  });

  it("keeps the history open when the address bar carries history filters", async () => {
    setTestUrl(`/interlink?url=${encodeURIComponent(PAGE_URL)}&status=APPROVED`);
    backend();
    renderPage();
    expect(await screen.findByRole("region", { name: "Filter suggestions" })).toBeInTheDocument();
  });
});
