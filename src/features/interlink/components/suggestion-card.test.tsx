import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PAGE_1, PAGE_2, makeSuggestion } from "../testing/fixtures";
import { SuggestionCard } from "./suggestion-card";

describe("SuggestionCard", () => {
  it("shows the stored fields as returned by the backend", () => {
    const suggestion = makeSuggestion({ reason: "Line one.\nLine two." });
    render(<SuggestionCard suggestion={suggestion} />);

    expect(screen.getByRole("heading", { name: "patient engagement" })).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Relevance score" })).toHaveAttribute("aria-valuenow", "55");
    expect(screen.getByText("55")).toBeInTheDocument();
    expect(screen.getByText("Line one. Line two.", { normalizer: (text) => text.replace(/\s+/g, " ") })).toBeInTheDocument();
    expect(screen.getByText(PAGE_1)).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("shows the target URL as a link that opens in a new tab", () => {
    const suggestion = makeSuggestion();
    render(<SuggestionCard suggestion={suggestion} />);

    const link = screen.getByRole("link", { name: /opens in a new tab/ });
    expect(link).toHaveAccessibleName(expect.stringContaining(suggestion.target_url));
    expect(link).toHaveAttribute("href", suggestion.target_url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("Target URL", { selector: "dt" })).toBeInTheDocument();
    expect(screen.queryByText("Target page ID")).not.toBeInTheDocument();
    expect(screen.queryByText(PAGE_2)).not.toBeInTheDocument();
  });

  it("keeps a long target URL whole, wrapping it inside the card", () => {
    const target_url = `https://example.test/${"very-long-path-segment/".repeat(12)}?utm_source=${"x".repeat(80)}`;
    render(<SuggestionCard suggestion={makeSuggestion({ target_url })} />);

    const link = screen.getByRole("link", { name: /opens in a new tab/ });
    expect(link).toHaveAttribute("href", target_url);
    expect(link).toHaveAttribute("title", target_url);
    expect(link).toHaveTextContent(target_url);
    expect(link).toHaveClass("break-all");
  });

  it("renders the context verbatim, highlighting the anchor without altering the text", () => {
    const suggestion = makeSuggestion();
    render(<SuggestionCard suggestion={suggestion} />);
    const quote = screen.getByText((_, element) => element?.tagName === "BLOCKQUOTE");
    expect(quote.textContent).toBe(suggestion.context);
    expect(quote.querySelector("mark")).toHaveTextContent("patient engagement");
  });

  it("never grades the score with an evaluative label", () => {
    render(<SuggestionCard suggestion={makeSuggestion({ relevance_score: 98 })} />);
    expect(screen.queryByText(/excellent|best|good|poor|high|low/i)).not.toBeInTheDocument();
  });

  it("lets the reviewer expand a long context to read all of it", async () => {
    const user = userEvent.setup();
    const context = `${"A long sentence about patient engagement. ".repeat(10)}End.`;
    render(<SuggestionCard suggestion={makeSuggestion({ context })} />);

    const toggle = screen.getByRole("button", { name: "Show full context" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    const quote = document.getElementById(toggle.getAttribute("aria-controls") ?? "");
    expect(quote?.textContent).toBe(context);
    expect(quote).toHaveClass("line-clamp-3");

    await user.click(toggle);
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
    expect(quote).not.toHaveClass("line-clamp-3");
  });

  it("does not offer a toggle for a short context", () => {
    render(<SuggestionCard suggestion={makeSuggestion()} />);
    expect(screen.queryByRole("button", { name: "Show full context" })).not.toBeInTheDocument();
  });

  it("shows when an applied suggestion was applied", () => {
    render(<SuggestionCard suggestion={makeSuggestion({ status: "APPLIED", applied_at: "2026-09-23T09:00:00Z" })} />);
    expect(screen.getByText("Applied", { selector: "dt" })).toBeInTheDocument();
  });

  it("links the card to the suggestion's detail page without nesting interactive elements", () => {
    const suggestion = makeSuggestion();
    render(<SuggestionCard suggestion={suggestion} href={`/interlink/${suggestion.id}?status=PENDING`} />);

    const detail = screen.getByRole("link", { name: suggestion.anchor_text });
    expect(detail).toHaveAttribute("href", `/interlink/${suggestion.id}?status=PENDING`);
    expect(detail).not.toHaveAttribute("target");
    expect(detail.closest("h3")).not.toBeNull();

    const target = screen.getByRole("link", { name: /opens in a new tab/ });
    expect(target).toHaveAttribute("href", suggestion.target_url);
    expect(target).toHaveAttribute("target", "_blank");
    for (const element of screen.getAllByRole("link")) {
      expect(element.querySelector("a, button")).toBeNull();
      expect(element.parentElement?.closest("a, button")).toBeNull();
    }
  });

  it("defaults the detail link to the bare detail route", () => {
    const suggestion = makeSuggestion();
    render(<SuggestionCard suggestion={suggestion} />);
    expect(screen.getByRole("link", { name: suggestion.anchor_text })).toHaveAttribute("href", `/interlink/${suggestion.id}`);
  });
});
