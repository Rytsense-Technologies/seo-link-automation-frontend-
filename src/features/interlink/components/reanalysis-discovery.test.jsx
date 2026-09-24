import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient } from "@tanstack/react-query";
import { QueryProvider } from "@/lib/query/query-provider";
import { PAGE_1, SITE_A, jsonResponse, makeSite, makeSuggestion, stubBackend, suggestionList } from "../testing/fixtures";
import { setTestUrl } from "../testing/next-navigation-mock";
import { InterlinkPage } from "./interlink-page";

vi.mock("next/navigation", () => import("../testing/next-navigation-mock"));

const PAGE_URL = "https://example.test/new-service/";
const RESOLVED = {
  site: makeSite(SITE_A, "Example"),
  page: { id: PAGE_1, site_id: SITE_A, url: PAGE_URL, title: "New Service", h1: "New Service", http_status: 200 },
};
const suggestion = (n, overrides = {}) =>
  makeSuggestion({
    id: `d${n}d${n}d${n}d${n}-${n}${n}${n}${n}-4${n}${n}${n}-8${n}${n}${n}-${String(n).repeat(12)}`,
    anchor_text: `anchor ${n}`,
    target_page_id: `e${n}e${n}e${n}e${n}-${n}${n}${n}${n}-4${n}${n}${n}-8${n}${n}${n}-${String(n).repeat(12)}`,
    target_url: `https://example.test/target-${n}/`,
    ...overrides,
  });
const apiError = (status, code, details = null) => jsonResponse(status, { error: { code, message: `backend: ${code}`, details } });

function deferred() {
  let resolve = () => undefined;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/**
 * A stateful fake of resolve / discover / analyze / list. `indexed` flips when the page is
 * crawled; each analyze adds `nextNew` to the page's suggestions, as the backend would (it only
 * ever adds suggestions for pairs that have none).
 */
function fakeBackend({ indexed = true, existing = [], nextNew = [], discover, analyze, gate } = {}) {
  const state = { indexed, suggestions: [...existing], nextNew: [...nextNew] };
  const api = stubBackend({
    sites: () => jsonResponse(200, [RESOLVED.site]),
    "pages/resolve": () => (state.indexed ? jsonResponse(200, RESOLVED) : apiError(404, "PAGE_NOT_FOUND")),
    "pages/discover": async () => {
      await gate;
      if (discover) return discover();
      state.indexed = true;
      return jsonResponse(200, RESOLVED);
    },
    "interlink/analyze": async () => {
      await gate;
      if (analyze) return analyze();
      const created = state.nextNew;
      state.nextNew = [];
      state.suggestions = [...created, ...state.suggestions];
      return jsonResponse(200, { source_page_id: PAGE_1, generation_mode: "ai", ai_error: null, suggestions: created });
    },
    "interlink/suggestions": (query) =>
      jsonResponse(200, query.get("source_page_id") === PAGE_1 ? suggestionList(state.suggestions, { page_size: 50 }) : suggestionList([])),
  });
  return { api, state };
}

function renderPage() {
  const user = userEvent.setup();
  render(
    <QueryProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30_000 } } })}
    >
      <InterlinkPage />
    </QueryProvider>,
  );
  return user;
}

const urlInput = () => screen.getByLabelText("Page URL");
const mainButton = () => within(screen.getByRole("region", { name: "Analyze a page" })).getByRole("button", { name: /Analyz/ });
const analysisRegion = () => screen.findByRole("region", { name: "Analysis" });
const resultCards = async () => within(await analysisRegion()).findAllByRole("article");
const search = () => new URLSearchParams(window.location.search);

beforeEach(() => {
  setTestUrl("/interlink");
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("new page discovery", () => {
  it("analyzes an indexed page directly, without crawling", async () => {
    const { api } = fakeBackend({ nextNew: [suggestion(1)] });
    const user = renderPage();
    await user.type(urlInput(), `${PAGE_URL}{Enter}`);

    expect(await resultCards()).toHaveLength(1);
    expect(api.calls("pages/discover")).toHaveLength(0);
    expect(api.calls("interlink/analyze")).toHaveLength(1);
  });

  it("explains an unindexed page and offers Crawl & Analyze instead of an error", async () => {
    const { api } = fakeBackend({ indexed: false });
    const user = renderPage();
    await user.type(urlInput(), `${PAGE_URL}{Enter}`);

    const notice = (await screen.findByRole("heading", { name: "Page not indexed yet" })).parentElement;
    expect(notice).toHaveTextContent("We haven't indexed this page yet, so we can't generate internal-link suggestions for it.");
    expect(notice).toHaveTextContent("Run a crawl to add this page to the internal-link index.");
    expect(within(notice).getByRole("button", { name: "Crawl & Analyze" })).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/couldn't find this page/)).not.toBeInTheDocument();
    expect(api.calls("interlink/analyze")).toHaveLength(0);
    expect(api.calls("pages/discover")).toHaveLength(0); // nothing is crawled until the reviewer asks
  });

  it("does not offer a crawl for other errors", async () => {
    fakeBackend({ analyze: () => apiError(422, "SOURCE_CONTENT_EMPTY") });
    const user = renderPage();
    await user.type(urlInput(), `${PAGE_URL}{Enter}`);
    expect(await screen.findByRole("alert")).toHaveTextContent("doesn't contain enough usable content");
    expect(screen.queryByRole("button", { name: "Crawl & Analyze" })).not.toBeInTheDocument();
  });

  it("crawls, then analyzes on its own, in one click", async () => {
    const gate = deferred();
    const { api } = fakeBackend({ indexed: false, nextNew: [suggestion(1), suggestion(2)], gate: gate.promise });
    const user = renderPage();
    await user.type(urlInput(), `${PAGE_URL}{Enter}`);
    await user.click(await screen.findByRole("button", { name: "Crawl & Analyze" }));

    expect(await screen.findByText("Crawling the page on your website…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crawling & analyzing…" })).toBeDisabled();
    expect(mainButton()).toBeDisabled();
    expect(urlInput()).toHaveValue(PAGE_URL);
    expect(urlInput()).toHaveAttribute("readonly");
    gate.resolve();

    expect(await resultCards()).toHaveLength(2);
    expect(api.calls("pages/discover")).toHaveLength(1);
    expect(JSON.parse(api.calls("pages/discover")[0].init.body)).toEqual({ url: PAGE_URL });
    expect(JSON.parse(api.calls("interlink/analyze")[0].init.body).source_page_id).toBe(PAGE_1);
    expect(search().get("url")).toBe(PAGE_URL);
    expect(screen.queryByRole("heading", { name: "Page not indexed yet" })).not.toBeInTheDocument();
  });

  it("sends only one crawl however often it is pressed", async () => {
    const gate = deferred();
    const { api } = fakeBackend({ indexed: false, nextNew: [suggestion(1)], gate: gate.promise });
    const user = renderPage();
    await user.type(urlInput(), `${PAGE_URL}{Enter}`);
    const crawl = await screen.findByRole("button", { name: "Crawl & Analyze" });

    await user.click(crawl);
    fireEvent.click(screen.getByRole("button", { name: "Crawling & analyzing…" }));
    fireEvent.submit(urlInput().closest("form"));
    gate.resolve();

    await resultCards();
    expect(api.calls("pages/discover")).toHaveLength(1);
    expect(api.calls("interlink/analyze")).toHaveLength(1);
  });

  it.each([
    ["PAGE_HTTP_ERROR", 422, { http_status: 404 }, "We couldn't access this page because it returned 404."],
    ["PAGE_HTTP_ERROR", 422, { http_status: 410 }, "We couldn't access this page because it returned 410."],
    ["PAGE_BLOCKED_BY_ROBOTS", 422, null, "This website's robots.txt doesn't allow this page to be crawled."],
    ["PAGE_URL_BLOCKED", 422, null, "That URL can't be crawled by the system."],
    ["START_URL_BLOCKED", 422, null, "That URL can't be crawled by the system."],
    ["PAGE_FETCH_FAILED", 502, null, "We couldn't load this page (it may have timed out). Please try again."],
    ["PAGE_REDIRECTED", 422, null, "This URL redirects to a page outside the indexed website"],
    ["PAGE_NOT_HTML", 422, null, "This URL isn't a web page"],
    ["CRAWL_IN_PROGRESS", 409, null, "A crawl of this website is already running."],
  ])("explains a failed crawl (%s)", async (code, status, details, message) => {
    const { api } = fakeBackend({ indexed: false, discover: () => apiError(status, code, details) });
    const user = renderPage();
    await user.type(urlInput(), `${PAGE_URL}{Enter}`);
    await user.click(await screen.findByRole("button", { name: "Crawl & Analyze" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(message);
    expect(alert).toHaveTextContent(`${code} · HTTP ${status}`);
    expect(api.calls("interlink/analyze")).toHaveLength(0);
    expect(screen.queryByRole("heading", { name: "Page not indexed yet" })).not.toBeInTheDocument();
    expect(mainButton()).toBeEnabled();
  });

  it("explains a crawled page without usable content", async () => {
    fakeBackend({ indexed: false, analyze: () => apiError(422, "NO_LINKABLE_CONTENT") });
    const user = renderPage();
    await user.type(urlInput(), `${PAGE_URL}{Enter}`);
    await user.click(await screen.findByRole("button", { name: "Crawl & Analyze" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This page doesn't contain enough usable content to generate internal-link suggestions.",
    );
  });

  it("forgets the notice once the reviewer edits the URL", async () => {
    fakeBackend({ indexed: false });
    const user = renderPage();
    await user.type(urlInput(), `${PAGE_URL}{Enter}`);
    await screen.findByRole("heading", { name: "Page not indexed yet" });
    await user.type(urlInput(), "x");
    expect(screen.queryByRole("heading", { name: "Page not indexed yet" })).not.toBeInTheDocument();
  });
});

describe("analyze again", () => {
  const EXISTING = [suggestion(1, { status: "APPROVED" }), suggestion(2, { status: "REJECTED" })];

  it("is offered for the page on screen, and not for a different URL", async () => {
    setTestUrl(`/interlink?url=${encodeURIComponent(PAGE_URL)}`);
    fakeBackend({ existing: EXISTING });
    const user = renderPage();
    await analysisRegion();

    expect(mainButton()).toHaveTextContent("Analyze again");
    expect(urlInput()).toHaveAccessibleDescription("Re-analyze this page to find new internal-link opportunities.");

    await user.clear(urlInput());
    await user.type(urlInput(), "https://example.test/another-page/");
    expect(mainButton()).toHaveTextContent("Analyze page");
  });

  it("keeps every existing suggestion, adds only the new one, and says which is which", async () => {
    setTestUrl(`/interlink?url=${encodeURIComponent(PAGE_URL)}`);
    const gate = deferred();
    const { api } = fakeBackend({ existing: EXISTING, nextNew: [suggestion(3)], gate: gate.promise });
    const user = renderPage();
    expect(await resultCards()).toHaveLength(2);

    await user.click(mainButton());
    expect(await screen.findByText("Analyzing the page…")).toBeInTheDocument(); // the analyze request is held
    expect(mainButton()).toHaveTextContent("Analyzing page…");
    expect(mainButton()).toBeDisabled();
    gate.resolve();

    const analysis = await analysisRegion();
    const summary = (await within(analysis).findByText("Analysis complete")).parentElement;
    expect(summary).toHaveTextContent("1 new suggestion found.");
    await waitFor(() => expect(summary).toHaveTextContent("2 existing suggestions were already tracked."));

    const cards = await within(analysis).findAllByRole("article");
    const anchorOf = (card) => card.querySelector("h4").textContent.replace(/[“”]/g, ""); // minus the decorative quotes
    const anchors = cards.map(anchorOf);
    expect(anchors.sort()).toEqual(["anchor 1", "anchor 2", "anchor 3"]); // no duplicates, none lost
    const status = (anchor) =>
      cards.find((card) => anchorOf(card) === anchor).querySelector("[data-status]").dataset.status;
    expect([status("anchor 1"), status("anchor 2"), status("anchor 3")]).toEqual(["APPROVED", "REJECTED", "PENDING"]);

    expect(api.calls("interlink/analyze")).toHaveLength(1);
    expect(search().get("url")).toBe(PAGE_URL); // still in the address bar
  });

  it("says when nothing new was found, and that the existing suggestions are still there", async () => {
    setTestUrl(`/interlink?url=${encodeURIComponent(PAGE_URL)}`);
    fakeBackend({ existing: EXISTING, nextNew: [] });
    const user = renderPage();
    await resultCards();

    await user.click(mainButton());

    const summary = (await screen.findByText("Analysis complete")).parentElement;
    expect(summary).toHaveTextContent("No new internal-link opportunities found.");
    expect(summary).toHaveTextContent("The existing suggestions are still available below.");
    expect(await resultCards()).toHaveLength(2);
  });

  it("restores the page from the address bar after a refresh, without re-analyzing", async () => {
    setTestUrl(`/interlink?url=${encodeURIComponent(PAGE_URL)}`);
    const { api } = fakeBackend({ existing: EXISTING });
    renderPage();
    expect(await resultCards()).toHaveLength(2);
    expect(urlInput()).toHaveValue(PAGE_URL);
    expect(api.calls("interlink/analyze")).toHaveLength(0);
    expect(api.calls("pages/discover")).toHaveLength(0);
  });
});
