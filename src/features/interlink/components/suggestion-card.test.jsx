import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { PAGE_1, PAGE_2, makePage, makeSuggestion } from "../testing/fixtures";
import { SuggestionCard } from "./suggestion-card";

const SIGNAL_REASON =
  'The source sentence already mentions "patient engagement", which matches the target page\'s H1. Strongest deterministic signals: slug_similarity 0.96, content_title 0.87.';

describe("SuggestionCard", () => {
  it("shows the anchor, status and relevance as a percentage", () => {
    render(<SuggestionCard suggestion={makeSuggestion()} />);

    expect(screen.getByRole("heading", { name: "patient engagement" })).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    const meter = screen.getByRole("meter", { name: "Relevance score" });
    expect(meter).toHaveAttribute("aria-valuenow", "55");
    expect(screen.getByText("55%")).toBeInTheDocument();
  });

  it("never grades the score with an evaluative label", () => {
    render(<SuggestionCard suggestion={makeSuggestion({ relevance_score: 98 })} />);
    expect(screen.queryByText(/excellent|best|good|poor|high|low/i)).not.toBeInTheDocument();
  });

  it("shows the target as its path, linked to the full URL in a new tab", () => {
    const suggestion = makeSuggestion();
    render(<SuggestionCard suggestion={suggestion} />);

    const link = screen.getByRole("link", { name: /opens in a new tab/ });
    expect(link).toHaveAttribute("href", suggestion.target_url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("title", suggestion.target_url);
    expect(link).toHaveAccessibleName(expect.stringContaining("/services/patient-engagement/"));
    expect(screen.getByText("Links to")).toBeInTheDocument();
    expect(screen.queryByText(PAGE_2)).not.toBeInTheDocument();
  });

  it("wraps a long target URL instead of overflowing", () => {
    const target_url = `https://example.test/${"very-long-path-segment/".repeat(12)}?utm_source=${"x".repeat(80)}`;
    render(<SuggestionCard suggestion={makeSuggestion({ target_url })} />);

    const link = screen.getByRole("link", { name: /opens in a new tab/ });
    expect(link).toHaveAttribute("href", target_url);
    expect(link).toHaveAttribute("title", target_url);
    expect(link).toHaveClass("[overflow-wrap:anywhere]");
  });

  it("shows the source page's path when the page is known", () => {
    render(<SuggestionCard suggestion={makeSuggestion()} sourcePage={makePage(PAGE_1, "/healthcare-chatbots/")} />);
    expect(screen.getByText("Source")).toBeInTheDocument();
    expect(screen.getByText("/healthcare-chatbots/")).toHaveAttribute("title", "https://example.test/healthcare-chatbots/");
  });

  it("falls back to the source page ID when the page is not known", () => {
    render(<SuggestionCard suggestion={makeSuggestion()} />);
    expect(screen.getByText(PAGE_1)).toBeInTheDocument();
  });

  it("explains why in plain language, leaving the raw signals to the detail page", () => {
    render(<SuggestionCard suggestion={makeSuggestion({ reason: SIGNAL_REASON })} />);
    expect(
      screen.getByText('The source sentence already mentions "patient engagement", which matches the target page\'s H1.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/slug_similarity/)).not.toBeInTheDocument();
  });

  it("shows a reason it cannot split exactly as returned", () => {
    render(<SuggestionCard suggestion={makeSuggestion({ reason: "Line one.\nLine two." })} />);
    expect(screen.getByText("Line one. Line two.", { normalizer: (text) => text.replace(/\s+/g, " ") })).toBeInTheDocument();
  });

  it("shows when an applied suggestion was applied", () => {
    render(<SuggestionCard suggestion={makeSuggestion({ status: "APPLIED", applied_at: "2026-09-23T09:00:00Z" })} />);
    expect(screen.getByText(/Applied/, { selector: "p" }).querySelectorAll("time")).toHaveLength(2);
  });

  it("links to the detail page with a clear action, without making the whole card a link", () => {
    const suggestion = makeSuggestion();
    render(<SuggestionCard suggestion={suggestion} href={`/interlink/${suggestion.id}?status=PENDING`} />);

    const detail = screen.getByRole("link", { name: `Review suggestion: ${suggestion.anchor_text}` });
    expect(detail).toHaveAttribute("href", `/interlink/${suggestion.id}?status=PENDING`);
    expect(detail).not.toHaveAttribute("target");

    const article = screen.getByRole("article");
    expect(article.closest("a")).toBeNull();
    expect(within(article).getByRole("heading", { name: suggestion.anchor_text }).closest("a")).toBeNull();
    expect(within(article).getAllByRole("link")).toHaveLength(2); // target URL + Review suggestion
    for (const element of screen.getAllByRole("link")) {
      expect(element.querySelector("a, button")).toBeNull();
      expect(element.parentElement?.closest("a, button")).toBeNull();
    }
  });

  it("defaults the detail link to the bare detail route", () => {
    const suggestion = makeSuggestion();
    render(<SuggestionCard suggestion={suggestion} />);
    expect(screen.getByRole("link", { name: /Review suggestion/ })).toHaveAttribute("href", `/interlink/${suggestion.id}`);
  });
});
