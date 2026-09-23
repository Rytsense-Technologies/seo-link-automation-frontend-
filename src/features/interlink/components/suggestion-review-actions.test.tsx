import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient } from "@tanstack/react-query";
import { QueryProvider } from "@/lib/query/query-provider";
import { jsonResponse, makeSuggestionDetail, stubBackend, type StubRequest } from "../testing/fixtures";
import type { SuggestionDetail as SuggestionDetailData, SuggestionStatus } from "../types/suggestions";
import { SuggestionDetail } from "./suggestion-detail";

const ID = makeSuggestionDetail().id;
const BASE = `interlink/suggestions/${ID}`;

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * A stateful fake of the three endpoints, applying the backend's transition rules, so the tests
 * see the same refresh cycle as the real app (action -> invalidate -> refetched detail).
 */
function fakeBackend(initial: Partial<SuggestionDetailData> = {}, hooks: { gate?: Promise<void> } = {}) {
  let state = makeSuggestionDetail(initial);
  const transition = async (to: SuggestionStatus, allowed: SuggestionStatus[], patch: Partial<SuggestionDetailData>) => {
    await hooks.gate;
    if (!allowed.includes(state.status)) {
      return jsonResponse(409, {
        error: {
          code: "INVALID_STATUS_TRANSITION",
          message: `Cannot change suggestion from ${state.status} to ${to}`,
          details: { current_status: state.status, requested_status: to },
        },
      });
    }
    state = { ...state, ...patch, status: to, reviewed_at: "2026-09-23T12:00:00Z" };
    return jsonResponse(200, state);
  };
  const api = stubBackend({
    [BASE]: () => jsonResponse(200, state),
    [`${BASE}/approve`]: () => transition("APPROVED", ["PENDING", "REJECTED"], { rejection_reason: null }),
    [`${BASE}/reject`]: (_query, request: StubRequest) =>
      transition("REJECTED", ["PENDING", "APPROVED"], {
        rejection_reason: (request.body as { reason?: string } | undefined)?.reason ?? null,
      }),
  });
  return {
    api,
    /** Simulates another reviewer changing the suggestion behind this page's back. */
    setStatus: (status: SuggestionStatus) => {
      state = { ...state, status };
    },
    posts: (action: "approve" | "reject") => api.calls(`${BASE}/${action}`),
  };
}

function renderDetail() {
  const user = userEvent.setup();
  render(
    <QueryProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })}>
      <SuggestionDetail suggestionId={ID} backHref="/interlink" />
    </QueryProvider>,
  );
  return user;
}

const actionsRegion = () => screen.findByRole("region", { name: "Review actions" });
const headerStatus = () => within(screen.getByRole("banner")).getByText(/Pending|Approved|Rejected|Applied/);

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("review actions by status", () => {
  it("PENDING offers Approve (primary) and Reject", async () => {
    fakeBackend();
    renderDetail();
    const region = await actionsRegion();
    expect(within(region).getByRole("button", { name: "Approve" })).toHaveClass("bg-blue-600");
    expect(within(region).getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(within(region).getByText("Pending")).toBeInTheDocument();
  });

  it("APPROVED offers Reject only", async () => {
    fakeBackend({ status: "APPROVED" });
    renderDetail();
    const region = await actionsRegion();
    expect(within(region).queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(within(region).getByText("Approved")).toBeInTheDocument();
  });

  it("REJECTED offers Approve only, with the stored rejection reason shown once", async () => {
    fakeBackend({ status: "REJECTED", rejection_reason: "Duplicate of an existing link." });
    renderDetail();
    const region = await actionsRegion();
    expect(within(region).getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(within(region).queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    expect(within(region).getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Rejection reason" })).toHaveTextContent("Duplicate of an existing link.");
    expect(screen.getAllByText("Duplicate of an existing link.")).toHaveLength(1);
  });

  it("APPLIED offers no review actions, and there is no Apply button", async () => {
    fakeBackend({ status: "APPLIED", applied_at: "2026-09-23T10:00:00Z" });
    renderDetail();
    const region = await actionsRegion();
    expect(within(region).queryAllByRole("button")).toHaveLength(0);
    expect(within(region).getByText("This suggestion has been applied. No review actions are available.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /apply/i })).not.toBeInTheDocument();
  });
});

describe("approve", () => {
  it("POSTs through the BFF, shows progress, then the backend-confirmed APPROVED status", async () => {
    const gate = deferred();
    const backend = fakeBackend({}, { gate: gate.promise });
    const user = renderDetail();
    const region = await actionsRegion();

    await user.click(within(region).getByRole("button", { name: "Approve" }));

    const pending = within(region).getByRole("button", { name: "Approving…" });
    expect(pending).toBeDisabled();
    expect(within(region).getByRole("button", { name: "Reject" })).toBeDisabled();
    expect(headerStatus()).toHaveTextContent("Pending"); // no optimistic change

    gate.resolve();
    expect(await within(region).findByText("Suggestion approved.")).toBeInTheDocument();
    expect(headerStatus()).toHaveTextContent("Approved");
    expect(within(region).queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Reject" })).toBeEnabled();

    const [post] = backend.posts("approve");
    expect(post?.method).toBe("POST");
    expect(post?.init?.body).toBeUndefined();
    expect(backend.api.requests(BASE)).toHaveLength(2); // initial load + refresh after approve
    const urls = backend.api.fetchMock.mock.calls.map(([input]) => String(input));
    expect(urls.every((url) => url.startsWith("/api/backend/"))).toBe(true);
  });

  it("sends one request however often the button is pressed", async () => {
    const gate = deferred();
    const backend = fakeBackend({}, { gate: gate.promise });
    const user = renderDetail();
    const region = await actionsRegion();
    const approve = within(region).getByRole("button", { name: "Approve" });

    await user.click(approve);
    await user.click(approve);
    fireEvent.click(approve);
    gate.resolve();

    await within(region).findByText("Suggestion approved.");
    expect(backend.posts("approve")).toHaveLength(1);
  });

  it("explains a 409 and refreshes to the current status", async () => {
    const backend = fakeBackend();
    const user = renderDetail();
    const region = await actionsRegion();
    backend.setStatus("APPLIED"); // someone else moved it on

    await user.click(within(region).getByRole("button", { name: "Approve" }));

    expect(
      await within(region).findByText("This suggestion was already updated (it is now APPLIED). Its current status has been refreshed."),
    ).toBeInTheDocument();
    await waitFor(() => expect(headerStatus()).toHaveTextContent("Applied"));
    expect(within(region).queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it("shows other API errors with their code and lets the reviewer try again", async () => {
    const backend = fakeBackend();
    const user = renderDetail();
    const region = await actionsRegion();
    backend.api.fetchMock.mockImplementationOnce(async () =>
      jsonResponse(503, { error: { code: "DATABASE_ERROR", message: "A database error occurred" } }),
    );

    await user.click(within(region).getByRole("button", { name: "Approve" }));

    const alert = await within(region).findByRole("alert");
    expect(alert).toHaveTextContent("Could not approve the suggestion. A database error occurred");
    expect(alert).toHaveTextContent("DATABASE_ERROR · HTTP 503");
    expect(within(region).getByRole("button", { name: "Approve" })).toBeEnabled();
  });
});

describe("reject", () => {
  async function openReject() {
    const user = renderDetail();
    const region = await actionsRegion();
    await user.click(within(region).getByRole("button", { name: "Reject" }));
    const form = within(region).getByRole("form", { name: "Reject suggestion" });
    return { user, region, form, textarea: within(form).getByLabelText("Reason (optional)") };
  }

  it("opens an inline form with a focused textarea and a counter", async () => {
    fakeBackend();
    const { user, form, textarea, region } = await openReject();

    expect(textarea).toHaveFocus();
    expect(within(form).getByText("0 / 2000")).toBeInTheDocument();
    expect(within(region).queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();

    await user.type(textarea, "Not relevant");
    expect(within(form).getByText("12 / 2000")).toBeInTheDocument();
  });

  it("sends the trimmed reason, then shows REJECTED and the stored reason", async () => {
    const gate = deferred();
    const backend = fakeBackend({}, { gate: gate.promise });
    const { user, form, textarea, region } = await openReject();

    await user.type(textarea, "   Target page is outdated.   ");
    await user.click(within(form).getByRole("button", { name: "Reject" }));

    expect(within(form).getByRole("button", { name: "Rejecting…" })).toBeDisabled();
    expect(within(form).getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(textarea).toBeDisabled();

    gate.resolve();
    expect(await within(region).findByText("Suggestion rejected.")).toBeInTheDocument();
    expect(within(region).queryByRole("form")).not.toBeInTheDocument();
    expect(headerStatus()).toHaveTextContent("Rejected");
    expect(screen.getByRole("region", { name: "Rejection reason" })).toHaveTextContent("Target page is outdated.");
    expect(within(region).getByRole("button", { name: "Approve" })).toBeInTheDocument();

    const [post] = backend.posts("reject");
    expect(post?.method).toBe("POST");
    expect(post?.init?.body).toBe(JSON.stringify({ reason: "Target page is outdated." }));
  });

  it("treats a whitespace-only reason as no reason", async () => {
    const backend = fakeBackend();
    const { user, form, textarea } = await openReject();

    await user.type(textarea, "   ");
    expect(within(form).getByText("0 / 2000")).toBeInTheDocument();
    await user.click(within(form).getByRole("button", { name: "Reject" }));

    await waitFor(() => expect(headerStatus()).toHaveTextContent("Rejected"));
    expect(backend.posts("reject")[0]?.init?.body).toBe("{}");
    expect(screen.queryByRole("region", { name: "Rejection reason" })).not.toBeInTheDocument();
  });

  it("blocks a reason over 2000 characters", async () => {
    const backend = fakeBackend();
    const { user, form, textarea } = await openReject();

    await user.click(textarea);
    await user.paste("x".repeat(2001));

    expect(within(form).getByText(/2001 \/ 2000/)).toHaveTextContent("the reason must be 2000 characters or fewer");
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    const submit = within(form).getByRole("button", { name: "Reject" });
    expect(submit).toBeDisabled();
    fireEvent.submit(form);
    expect(backend.posts("reject")).toHaveLength(0);

    await user.keyboard("{Backspace}");
    expect(within(form).getByText("2000 / 2000")).toBeInTheDocument();
    expect(submit).toBeEnabled();
  });

  it("does not submit on Enter in the textarea", async () => {
    const backend = fakeBackend();
    const { user, textarea } = await openReject();
    await user.type(textarea, "line one{Enter}line two");
    expect(textarea).toHaveValue("line one\nline two");
    expect(backend.posts("reject")).toHaveLength(0);
  });

  it("Cancel closes the form without a request and returns focus to Reject", async () => {
    const backend = fakeBackend();
    const { user, form, region } = await openReject();
    await user.click(within(form).getByRole("button", { name: "Cancel" }));

    expect(within(region).queryByRole("form")).not.toBeInTheDocument();
    await waitFor(() => expect(within(region).getByRole("button", { name: "Reject" })).toHaveFocus());
    expect(backend.posts("reject")).toHaveLength(0);
  });

  it("Escape closes the form, and a reopened form starts empty", async () => {
    const backend = fakeBackend();
    const { user, textarea, region } = await openReject();
    await user.type(textarea, "draft");
    await user.keyboard("{Escape}");
    expect(within(region).queryByRole("form")).not.toBeInTheDocument();

    await user.click(within(region).getByRole("button", { name: "Reject" }));
    expect(within(region).getByLabelText("Reason (optional)")).toHaveValue("");
    expect(backend.posts("reject")).toHaveLength(0);
  });

  it("ignores Escape while the rejection is being sent", async () => {
    const gate = deferred();
    fakeBackend({}, { gate: gate.promise });
    const { user, form, region } = await openReject();
    await user.click(within(form).getByRole("button", { name: "Reject" }));
    fireEvent.keyDown(form, { key: "Escape" });
    expect(within(region).getByRole("form")).toBeInTheDocument();
    gate.resolve();
    await within(region).findByText("Suggestion rejected.");
  });

  it("sends one request however often the form is submitted", async () => {
    const gate = deferred();
    const backend = fakeBackend({}, { gate: gate.promise });
    const { user, form, region } = await openReject();
    await user.click(within(form).getByRole("button", { name: "Reject" }));
    fireEvent.submit(form);
    fireEvent.submit(form);
    gate.resolve();
    await within(region).findByText("Suggestion rejected.");
    expect(backend.posts("reject")).toHaveLength(1);
  });

  it("explains a 409, closes the form and refreshes to the current status", async () => {
    const backend = fakeBackend();
    const { user, form, region } = await openReject();
    backend.setStatus("REJECTED");

    await user.click(within(form).getByRole("button", { name: "Reject" }));

    expect(await within(region).findByText(/already updated \(it is now REJECTED\)/)).toBeInTheDocument();
    expect(within(region).queryByRole("form")).not.toBeInTheDocument();
    await waitFor(() => expect(headerStatus()).toHaveTextContent("Rejected"));
    expect(within(region).getByRole("button", { name: "Approve" })).toBeInTheDocument();
  });

  it("keeps the form open with the reason on other errors", async () => {
    const backend = fakeBackend();
    const { user, form, textarea, region } = await openReject();
    await user.type(textarea, "keep me");
    backend.api.fetchMock.mockImplementationOnce(async () =>
      jsonResponse(503, { error: { code: "DATABASE_ERROR", message: "A database error occurred" } }),
    );

    await user.click(within(form).getByRole("button", { name: "Reject" }));

    expect(await within(region).findByRole("alert")).toHaveTextContent("Could not reject the suggestion.");
    expect(textarea).toHaveValue("keep me");
    expect(textarea).toBeEnabled();
  });
});

describe("approving a rejected suggestion", () => {
  it("clears the rejection reason once the backend confirms", async () => {
    fakeBackend({ status: "REJECTED", rejection_reason: "Too generic." });
    const user = renderDetail();
    const region = await actionsRegion();

    await user.click(within(region).getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(headerStatus()).toHaveTextContent("Approved"));
    expect(screen.queryByRole("region", { name: "Rejection reason" })).not.toBeInTheDocument();
  });
});
