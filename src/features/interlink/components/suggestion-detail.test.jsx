import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient } from "@tanstack/react-query";
import SuggestionDetailPage from "@/app/interlink/[suggestionId]/page";
import { QueryProvider } from "@/lib/query/query-provider";
import { SITE_A, SOURCE_PAGE, TARGET_PAGE, jsonResponse, makeSuggestionDetail, stubBackend } from "../testing/fixtures";
import { SuggestionDetail } from "./suggestion-detail";

const SUGGESTION = makeSuggestionDetail();
const DETAIL_PATH = `interlink/suggestions/${SUGGESTION.id}`;

const testClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });

function renderDetail({ id = SUGGESTION.id, backHref = "/interlink" } = {}) {
  const user = userEvent.setup();
  render(
    <QueryProvider client={testClient()}>
      <SuggestionDetail suggestionId={id} backHref={backHref} />
    </QueryProvider>,
  );
  return user;
}

function serve(detail = {}) {
  return stubBackend({ [DETAIL_PATH]: () => jsonResponse(200, makeSuggestionDetail(detail)) });
}

const section = (name) => screen.getByRole("region", { name });
/** The collapsible "Technical details" panel (a <details>, not a landmark region). */
const technical = () => screen.getByText("Technical details").closest("details");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SuggestionDetail", () => {
  it("shows a loading skeleton, not a blank page, while the request runs", async () => {
    serve();
    renderDetail();
    expect(screen.getByRole("heading", { level: 1, name: "Internal Link Suggestion" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading suggestion" })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Suggested link" })).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Loading suggestion" })).not.toBeInTheDocument();
  });

  it("renders the full suggestion from the detail endpoint only", async () => {
    const api = serve();
    renderDetail();
    await screen.findByRole("region", { name: "Suggested link" });

    const header = screen.getByRole("banner");
    expect(within(header).getByText("Pending")).toBeInTheDocument();

    const paths = api.fetchMock.mock.calls.map(([input]) => new URL(String(input), "http://localhost").pathname);
    expect(paths).toEqual([`/api/backend/${DETAIL_PATH}`]);
  });

  it("shows the anchor text and the exact context, with the anchor highlighted", async () => {
    serve();
    renderDetail();
    const suggestion = await screen.findByRole("region", { name: "Suggested link" });

    expect(within(suggestion).getByText(SUGGESTION.anchor_text, { selector: "p" })).toBeInTheDocument();
    const quote = suggestion.querySelector("blockquote");
    expect(quote?.textContent).toBe(SUGGESTION.context);
    expect(quote?.querySelector("mark")).toHaveTextContent(SUGGESTION.anchor_text);
    expect(within(suggestion).getByText(/highlighted text is where the link to the target page would be inserted/)).toBeInTheDocument();
    const [source, target] = within(suggestion).getAllByRole("link", { name: /opens in a new tab/ });
    expect(source).toHaveAttribute("href", SUGGESTION.source_page.url);
    expect(target).toHaveAttribute("href", SUGGESTION.target_page.url);
    expect(target).toHaveAttribute("target", "_blank");
    // Source, then anchor, then target: the order the link reads in.
    const steps = within(suggestion).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(steps).toEqual(["Source page", "Anchor text", "Target page"]);
  });

  it.each([
    ["Source page", SOURCE_PAGE],
    ["Target page", TARGET_PAGE],
  ])("shows the %s title, H1 and URL as an external link", async (name, page) => {
    serve();
    renderDetail();
    await screen.findByRole("region", { name: "Suggested link" });
    const region = section(name);

    expect(within(region).getByText(page.title)).toBeInTheDocument();
    expect(within(region).getByText(page.h1)).toBeInTheDocument();
    const link = within(region).getByRole("link", { name: /opens in a new tab/ });
    expect(link).toHaveAttribute("href", page.url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAccessibleName(expect.stringContaining(page.url));
  });

  it("shows placeholders for a page without title or H1", async () => {
    serve({ source_page: { ...SOURCE_PAGE, title: null, h1: null } });
    renderDetail();
    await screen.findByRole("region", { name: "Suggested link" });
    expect(within(section("Source page")).getByText("No title")).toBeInTheDocument();
    expect(within(section("Source page")).getByText("No H1")).toBeInTheDocument();
  });

  it("shows the relevance score as a percentage, and the reason in plain language", async () => {
    serve({ reason: "Line one.\nLine two." });
    renderDetail();
    await screen.findByRole("region", { name: "Suggested link" });
    const relevance = section("Relevance");

    expect(within(relevance).getByRole("meter", { name: "Relevance score" })).toHaveAttribute("aria-valuenow", "55");
    expect(within(relevance).getByText("55%")).toBeInTheDocument();
    expect(
      within(section("Why this suggestion?")).getByText("Line one. Line two.", {
        normalizer: (text) => text.replace(/\s+/g, " "),
      }),
    ).toBeInTheDocument();
    expect(within(relevance).queryByText("Strongest signals")).not.toBeInTheDocument();
  });

  it("lists the scoring signals under relevance, and keeps the full reason in technical details", async () => {
    const reason =
      'The source sentence already mentions "patient engagement", which matches the target page\'s H1. Strongest deterministic signals: slug_similarity 0.96, content_title 0.87.';
    serve({ reason });
    renderDetail();
    await screen.findByRole("region", { name: "Suggested link" });

    expect(within(section("Why this suggestion?")).getByText(/which matches the target page's H1\.$/)).toBeInTheDocument();
    const signals = within(section("Relevance")).getAllByRole("listitem").map((item) => item.textContent);
    expect(signals).toEqual(["Slug similarity0.96", "Content title0.87"]);
    expect(within(technical()).getByText(reason)).toBeInTheDocument();
  });

  it("keeps retrieval score and generation details under technical details, closed by default", async () => {
    serve();
    renderDetail();
    await screen.findByRole("region", { name: "Suggested link" });
    const details = technical();

    expect(details).not.toHaveAttribute("open");
    expect(within(details).getByText("0.5487")).toBeInTheDocument();
    expect(within(details).getByText(SUGGESTION.id)).toBeInTheDocument();
  });

  it("shows a deterministic suggestion without inventing AI details", async () => {
    serve();
    renderDetail();
    await screen.findByRole("region", { name: "Suggested link" });
    const details = technical();

    expect(within(details).getByText("deterministic")).toBeInTheDocument();
    const model = within(details).getByText("Model").nextElementSibling;
    expect(model).toHaveTextContent("—None");
    expect(document.body).not.toHaveTextContent(/\bnull\b|\bundefined\b/);
  });

  it("shows the provider and model an AI suggestion records", async () => {
    serve({ ai_provider: "groq", ai_model: "llama-3.3-70b" });
    renderDetail();
    await screen.findByRole("region", { name: "Suggested link" });
    expect(within(technical()).getByText("groq")).toBeInTheDocument();
    expect(within(technical()).getByText("llama-3.3-70b")).toBeInTheDocument();
  });

  it("renders null metadata as readable placeholders", async () => {
    serve({ updated_at: null });
    renderDetail();
    await screen.findByRole("region", { name: "Suggested link" });
    const metadata = section("Timeline");

    expect(within(metadata).getByText("Not reviewed")).toBeInTheDocument();
    expect(within(metadata).getByText("Not applied")).toBeInTheDocument();
    expect(within(metadata).getByText("Updated").nextElementSibling).toHaveTextContent("—");
    expect(within(metadata).getByText("Created").nextElementSibling?.querySelector("time")).toHaveAttribute(
      "datetime",
      SUGGESTION.created_at,
    );
    expect(metadata).not.toHaveTextContent(/null|undefined|Invalid Date/);
  });

  it("shows review timestamps once they exist", async () => {
    serve({ status: "APPLIED", reviewed_at: "2026-09-23T09:00:00Z", applied_at: "2026-09-23T10:00:00Z" });
    renderDetail();
    await screen.findByRole("region", { name: "Suggested link" });
    const metadata = section("Timeline");
    expect(within(metadata).queryByText("Not reviewed")).not.toBeInTheDocument();
    expect(within(metadata).queryByText("Not applied")).not.toBeInTheDocument();
    expect(metadata.querySelectorAll("time")).toHaveLength(4);
  });

  it("shows the rejection reason only when there is one", async () => {
    serve({ status: "REJECTED", rejection_reason: "Target page is being retired." });
    renderDetail();
    expect(await screen.findByRole("region", { name: "Rejection reason" })).toHaveTextContent("Target page is being retired.");
  });

  it("has no rejection panel when the reason is null", async () => {
    serve();
    renderDetail();
    await screen.findByRole("region", { name: "Suggested link" });
    expect(screen.queryByRole("region", { name: "Rejection reason" })).not.toBeInTheDocument();
  });

  describe("errors", () => {
    it("shows 'Suggestion not found' for the backend's 404", async () => {
      stubBackend({
        [DETAIL_PATH]: () => jsonResponse(404, { error: { code: "SUGGESTION_NOT_FOUND", message: "Suggestion not found", details: null } }),
      });
      renderDetail({ backHref: "/interlink?status=PENDING" });

      expect(await screen.findByRole("heading", { name: "Suggestion not found" })).toBeInTheDocument();
      const backLinks = screen.getAllByRole("link", { name: /Back to suggestions/ });
      expect(backLinks).toHaveLength(2);
      for (const link of backLinks) expect(link).toHaveAttribute("href", "/interlink?status=PENDING");
    });

    it("treats a malformed id as not found without calling the backend", () => {
      const api = serve();
      renderDetail({ id: "not-a-uuid" });
      expect(screen.getByRole("heading", { name: "Suggestion not found" })).toBeInTheDocument();
      expect(api.fetchMock).not.toHaveBeenCalled();
    });

    it("shows other API errors with their code and a retry", async () => {
      let fail = true;
      const api = stubBackend({
        [DETAIL_PATH]: () =>
          fail
            ? jsonResponse(503, { error: { code: "DATABASE_ERROR", message: "A database error occurred" } })
            : jsonResponse(200, makeSuggestionDetail()),
      });
      const user = renderDetail();

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Could not load suggestion");
      expect(alert).toHaveTextContent("A database error occurred");
      expect(alert).toHaveTextContent("DATABASE_ERROR · HTTP 503");

      fail = false;
      await user.click(within(alert).getByRole("button", { name: "Retry" }));
      expect(await screen.findByRole("region", { name: "Suggested link" })).toBeInTheDocument();
      expect(api.requests(DETAIL_PATH)).toHaveLength(2);
    });
  });

  describe("back navigation", () => {
    it("is a keyboard-reachable link to the list", async () => {
      serve();
      const user = renderDetail({ backHref: "/interlink?status=PENDING" });
      await user.tab();
      const back = screen.getByRole("link", { name: "Back to suggestions" });
      expect(back).toHaveFocus();
      expect(back).toHaveAttribute("href", "/interlink?status=PENDING");
    });

    it("returns to the analysis the reviewer came from", async () => {
      serve();
      const pageUrl = "https://example.test/healthcare-chatbots/";
      const page = await SuggestionDetailPage({
        params: Promise.resolve({ suggestionId: SUGGESTION.id }),
        searchParams: Promise.resolve({ url: pageUrl, status: "PENDING" }),
      });
      render(<QueryProvider client={testClient()}>{page}</QueryProvider>);

      expect(screen.getByRole("link", { name: "Back to analysis" })).toHaveAttribute(
        "href",
        `/interlink?url=${encodeURIComponent(pageUrl)}&status=PENDING`,
      );
    });

    it("returns to the list with the filters the reviewer came from", async () => {
      serve();
      const page = await SuggestionDetailPage({
        params: Promise.resolve({ suggestionId: SUGGESTION.id }),
        searchParams: Promise.resolve({ status: "PENDING", site_id: SITE_A, page: "2", unknown: "x", min_relevance_score: "999" }),
      });
      render(<QueryProvider client={testClient()}>{page}</QueryProvider>);

      expect(screen.getByRole("link", { name: "Back to suggestions" })).toHaveAttribute(
        "href",
        `/interlink?status=PENDING&site_id=${SITE_A}&page=2`,
      );
    });
  });
});
