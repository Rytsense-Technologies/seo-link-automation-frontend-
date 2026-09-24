import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SUGGESTION_STATUSES } from "../lib/suggestion-status";
import { SuggestionStatusBadge } from "./suggestion-status-badge";

describe("SuggestionStatusBadge", () => {
  it.each([
    ["PENDING", "Pending"],
    ["APPROVED", "Approved"],
    ["REJECTED", "Rejected"],
    ["APPLIED", "Applied"],
  ])("renders %s as readable text, not colour alone", (status, label) => {
    render(<SuggestionStatusBadge status={status} />);
    const badge = screen.getByText(label).closest("[data-status]");
    expect(badge).toHaveAttribute("data-status", status);
    expect(badge).toHaveTextContent(`Status: ${label}`);
  });

  it("gives each status a distinct style", () => {
    const classes = SUGGESTION_STATUSES.map((status) => {
      const { container, unmount } = render(<SuggestionStatusBadge status={status} />);
      const className = container.firstElementChild?.className;
      unmount();
      return className;
    });
    expect(new Set(classes).size).toBe(SUGGESTION_STATUSES.length);
  });
});
