import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient } from "@tanstack/react-query";
import { QueryProvider } from "@/lib/query/query-provider";
import { jsonResponse, makeSuggestionDetail, stubBackend } from "../testing/fixtures";
import { SuggestionDetail } from "./suggestion-detail";

const ID = makeSuggestionDetail().id;
const BASE = `interlink/suggestions/${ID}`;

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * A stateful fake of the detail / approve / reject / apply endpoints, applying the backend's
 * transition rules, so the tests see the same refresh cycle as the real app (action ->
 * invalidate -> refetched detail). `hooks.applyError` makes apply fail with that error envelope.
 */
function fakeBackend(initial = {}, hooks = {}) {
  let state = makeSuggestionDetail(initial);
  const transition = async (to, allowed, patch) => {
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
    [`${BASE}/reject`]: (_query, request) =>
      transition("REJECTED", ["PENDING", "APPROVED"], {
        rejection_reason: request.body?.reason ?? null,
      }),
    [`${BASE}/apply`]: async () => {
      if (hooks.applyError) {
        await hooks.gate;
        const [status, code] = hooks.applyError;
        return jsonResponse(status, { error: { code, message: `backend: ${code}`, details: null } });
      }
      return transition("APPLIED", ["APPROVED"], { applied_at: "2026-09-23T13:30:00Z" });
    },
  });
  return {
    api,
    /** Simulates another reviewer changing the suggestion behind this page's back. */
    setStatus: (status) => {
      state = { ...state, status };
    },
    posts: (action) => api.calls(`${BASE}/${action}`),
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

const actionsRegion = () => screen.findByRole("region", { name: "Review decision" });
const headerStatus = () => within(screen.getByRole("banner")).getByText(/Pending|Approved|Rejected|Applied/);

function deferred() {
  let resolve = () => undefined;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("review actions by status", () => {
  it("PENDING offers Approve (primary) and Reject", async () => {
    fakeBackend();
    renderDetail();
    const region = await actionsRegion();
    expect(within(region).getByRole("button", { name: "Approve suggestion" })).toHaveClass("bg-blue-600");
    expect(within(region).getByRole("button", { name: "Reject suggestion" })).toBeInTheDocument();
    expect(within(region).getByText("Pending")).toBeInTheDocument();
  });

  it("APPROVED offers Reject only", async () => {
    fakeBackend({ status: "APPROVED" });
    renderDetail();
    const region = await actionsRegion();
    expect(within(region).queryByRole("button", { name: "Approve suggestion" })).not.toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Reject suggestion" })).toBeInTheDocument();
    expect(within(region).getByText("Approved")).toBeInTheDocument();
  });

  it("REJECTED offers Approve only, with the stored rejection reason shown once", async () => {
    fakeBackend({ status: "REJECTED", rejection_reason: "Duplicate of an existing link." });
    renderDetail();
    const region = await actionsRegion();
    expect(within(region).getByRole("button", { name: "Approve suggestion" })).toBeInTheDocument();
    expect(within(region).queryByRole("button", { name: "Reject suggestion" })).not.toBeInTheDocument();
    expect(within(region).getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Rejection reason" })).toHaveTextContent("Duplicate of an existing link.");
    expect(screen.getAllByText("Duplicate of an existing link.")).toHaveLength(1);
  });

  it("APPLIED offers no review actions, and there is no Apply button", async () => {
    fakeBackend({ status: "APPLIED", applied_at: "2026-09-23T10:00:00Z" });
    renderDetail();
    const region = await actionsRegion();
    expect(within(region).queryAllByRole("button")).toHaveLength(0);
    expect(within(region).getByText("This link has already been applied to the source page.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /apply/i })).not.toBeInTheDocument();
  });
});

describe("approve", () => {
  it("POSTs through the BFF, shows progress, then the backend-confirmed APPROVED status", async () => {
    const gate = deferred();
    const backend = fakeBackend({}, { gate: gate.promise });
    const user = renderDetail();
    const region = await actionsRegion();

    await user.click(within(region).getByRole("button", { name: "Approve suggestion" }));

    const pending = within(region).getByRole("button", { name: "Approving…" });
    expect(pending).toBeDisabled();
    expect(within(region).getByRole("button", { name: "Reject suggestion" })).toBeDisabled();
    expect(headerStatus()).toHaveTextContent("Pending"); // no optimistic change

    gate.resolve();
    expect(await within(region).findByText("Suggestion approved.")).toBeInTheDocument();
    expect(headerStatus()).toHaveTextContent("Approved");
    expect(within(region).queryByRole("button", { name: "Approve suggestion" })).not.toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Reject suggestion" })).toBeEnabled();

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
    const approve = within(region).getByRole("button", { name: "Approve suggestion" });

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

    await user.click(within(region).getByRole("button", { name: "Approve suggestion" }));

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

    await user.click(within(region).getByRole("button", { name: "Approve suggestion" }));

    const alert = await within(region).findByRole("alert");
    expect(alert).toHaveTextContent("Could not approve the suggestion. A database error occurred");
    expect(alert).toHaveTextContent("DATABASE_ERROR · HTTP 503");
    expect(within(region).getByRole("button", { name: "Approve suggestion" })).toBeEnabled();
  });
});

describe("reject", () => {
  async function openReject() {
    const user = renderDetail();
    const region = await actionsRegion();
    await user.click(within(region).getByRole("button", { name: "Reject suggestion" }));
    const form = within(region).getByRole("form", { name: "Why are you rejecting this suggestion?" });
    return { user, region, form, textarea: within(form).getByLabelText("Reason (optional)") };
  }

  it("opens an inline form with a focused textarea and a counter", async () => {
    fakeBackend();
    const { user, form, textarea, region } = await openReject();

    expect(textarea).toHaveFocus();
    expect(within(form).getByText("0 / 2000")).toBeInTheDocument();
    expect(within(region).queryByRole("button", { name: "Approve suggestion" })).not.toBeInTheDocument();

    await user.type(textarea, "Not relevant");
    expect(within(form).getByText("12 / 2000")).toBeInTheDocument();
  });

  it("sends the trimmed reason, then shows REJECTED and the stored reason", async () => {
    const gate = deferred();
    const backend = fakeBackend({}, { gate: gate.promise });
    const { user, form, textarea, region } = await openReject();

    await user.type(textarea, "   Target page is outdated.   ");
    await user.click(within(form).getByRole("button", { name: "Reject suggestion" }));

    expect(within(form).getByRole("button", { name: "Rejecting…" })).toBeDisabled();
    expect(within(form).getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(textarea).toBeDisabled();

    gate.resolve();
    expect(await within(region).findByText("Suggestion rejected.")).toBeInTheDocument();
    expect(within(region).queryByRole("form")).not.toBeInTheDocument();
    expect(headerStatus()).toHaveTextContent("Rejected");
    expect(screen.getByRole("region", { name: "Rejection reason" })).toHaveTextContent("Target page is outdated.");
    expect(within(region).getByRole("button", { name: "Approve suggestion" })).toBeInTheDocument();

    const [post] = backend.posts("reject");
    expect(post?.method).toBe("POST");
    expect(post?.init?.body).toBe(JSON.stringify({ reason: "Target page is outdated." }));
  });

  it("treats a whitespace-only reason as no reason", async () => {
    const backend = fakeBackend();
    const { user, form, textarea } = await openReject();

    await user.type(textarea, "   ");
    expect(within(form).getByText("0 / 2000")).toBeInTheDocument();
    await user.click(within(form).getByRole("button", { name: "Reject suggestion" }));

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
    const submit = within(form).getByRole("button", { name: "Reject suggestion" });
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
    await waitFor(() => expect(within(region).getByRole("button", { name: "Reject suggestion" })).toHaveFocus());
    expect(backend.posts("reject")).toHaveLength(0);
  });

  it("Escape closes the form, and a reopened form starts empty", async () => {
    const backend = fakeBackend();
    const { user, textarea, region } = await openReject();
    await user.type(textarea, "draft");
    await user.keyboard("{Escape}");
    expect(within(region).queryByRole("form")).not.toBeInTheDocument();

    await user.click(within(region).getByRole("button", { name: "Reject suggestion" }));
    expect(within(region).getByLabelText("Reason (optional)")).toHaveValue("");
    expect(backend.posts("reject")).toHaveLength(0);
  });

  it("ignores Escape while the rejection is being sent", async () => {
    const gate = deferred();
    fakeBackend({}, { gate: gate.promise });
    const { user, form, region } = await openReject();
    await user.click(within(form).getByRole("button", { name: "Reject suggestion" }));
    fireEvent.keyDown(form, { key: "Escape" });
    expect(within(region).getByRole("form")).toBeInTheDocument();
    gate.resolve();
    await within(region).findByText("Suggestion rejected.");
  });

  it("sends one request however often the form is submitted", async () => {
    const gate = deferred();
    const backend = fakeBackend({}, { gate: gate.promise });
    const { user, form, region } = await openReject();
    await user.click(within(form).getByRole("button", { name: "Reject suggestion" }));
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

    await user.click(within(form).getByRole("button", { name: "Reject suggestion" }));

    expect(await within(region).findByText(/already updated \(it is now REJECTED\)/)).toBeInTheDocument();
    expect(within(region).queryByRole("form")).not.toBeInTheDocument();
    await waitFor(() => expect(headerStatus()).toHaveTextContent("Rejected"));
    expect(within(region).getByRole("button", { name: "Approve suggestion" })).toBeInTheDocument();
  });

  it("keeps the form open with the reason on other errors", async () => {
    const backend = fakeBackend();
    const { user, form, textarea, region } = await openReject();
    await user.type(textarea, "keep me");
    backend.api.fetchMock.mockImplementationOnce(async () =>
      jsonResponse(503, { error: { code: "DATABASE_ERROR", message: "A database error occurred" } }),
    );

    await user.click(within(form).getByRole("button", { name: "Reject suggestion" }));

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

    await user.click(within(region).getByRole("button", { name: "Approve suggestion" }));

    await waitFor(() => expect(headerStatus()).toHaveTextContent("Approved"));
    expect(screen.queryByRole("region", { name: "Rejection reason" })).not.toBeInTheDocument();
  });
});

describe("review guidance", () => {
  it("explains each action next to its button", async () => {
    fakeBackend();
    renderDetail();
    const region = await actionsRegion();
    expect(within(region).getByRole("button", { name: "Approve suggestion" })).toHaveAccessibleDescription(
      "Approve this suggestion to make it available for applying to the source page.",
    );
    expect(within(region).getByRole("button", { name: "Reject suggestion" })).toHaveAccessibleDescription(
      "Reject this suggestion if the link is not relevant or useful.",
    );
  });

  it.each([
    ["PENDING", "This suggestion is waiting for your review."],
    ["APPROVED", "This suggestion is approved and ready to be applied."],
    ["REJECTED", "This suggestion has been rejected."],
    ["APPLIED", "This link has already been applied to the source page."],
  ])("tells the reviewer what %s means", async (status, message) => {
    fakeBackend({ status });
    renderDetail();
    expect(within(await actionsRegion()).getByText(message)).toBeInTheDocument();
  });

  it("styles approve as the primary action and reject as destructive", async () => {
    fakeBackend();
    const user = renderDetail();
    const region = await actionsRegion();
    expect(within(region).getByRole("button", { name: "Approve suggestion" })).toHaveClass("bg-blue-600");
    expect(within(region).getByRole("button", { name: "Reject suggestion" })).toHaveClass("text-red-700");

    await user.click(within(region).getByRole("button", { name: "Reject suggestion" }));
    const form = within(region).getByRole("form", { name: "Why are you rejecting this suggestion?" });
    expect(within(form).getByRole("button", { name: "Reject suggestion" })).toHaveClass("bg-red-600");
    expect(within(form).getByRole("button", { name: "Cancel" })).toBeEnabled();
  });
});

describe("apply", () => {
  const openConfirm = async (backendHooks = {}) => {
    const backend = fakeBackend({ status: "APPROVED" }, backendHooks);
    const user = renderDetail();
    const region = await actionsRegion();
    await user.click(within(region).getByRole("button", { name: "Apply link" }));
    const confirm = within(region).getByRole("form", { name: "Apply this internal link?" });
    return { backend, user, region, confirm };
  };

  it.each(["PENDING", "REJECTED", "APPLIED"])("is not offered for %s suggestions", async (status) => {
    fakeBackend({ status });
    renderDetail();
    const region = await actionsRegion();
    expect(within(region).queryByRole("button", { name: /apply/i })).not.toBeInTheDocument();
  });

  it("is offered for an APPROVED suggestion, with what it will do", async () => {
    fakeBackend({ status: "APPROVED" });
    renderDetail();
    const region = await actionsRegion();
    expect(within(region).getByText("This suggestion is approved and ready to be applied.")).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Apply link" })).toHaveAccessibleDescription(
      "Inserts this link into the source page. You'll be asked to confirm first.",
    );
    expect(within(region).getByRole("button", { name: "Reject suggestion" })).toBeInTheDocument();
  });

  it("asks for confirmation, showing source, anchor and target, before sending anything", async () => {
    const { backend, confirm } = await openConfirm();

    expect(confirm).toHaveTextContent("Healthcare Chatbots | Example");
    expect(confirm).toHaveTextContent("“patient engagement”");
    expect(confirm).toHaveTextContent("Patient Engagement Services");
    expect(confirm).toHaveTextContent("This will modify the source page content.");
    expect(within(confirm).getByRole("button", { name: "Cancel" })).toHaveFocus(); // a stray Enter cannot apply
    expect(backend.posts("apply")).toHaveLength(0);
  });

  it("cancels without a request, by button or Escape", async () => {
    const { backend, user, region, confirm } = await openConfirm();
    await user.click(within(confirm).getByRole("button", { name: "Cancel" }));
    expect(within(region).queryByRole("form")).not.toBeInTheDocument();
    await waitFor(() => expect(within(region).getByRole("button", { name: "Apply link" })).toHaveFocus());

    await user.click(within(region).getByRole("button", { name: "Apply link" }));
    await user.keyboard("{Escape}");
    expect(within(region).queryByRole("form")).not.toBeInTheDocument();
    expect(backend.posts("apply")).toHaveLength(0);
  });

  it("applies once after confirmation, then shows the APPLIED state with its time", async () => {
    const gate = deferred();
    const { backend, user, region, confirm } = await openConfirm({ gate: gate.promise });

    await user.click(within(confirm).getByRole("button", { name: "Apply link" }));
    expect(within(confirm).getByRole("button", { name: "Applying…" })).toBeDisabled();
    expect(within(confirm).getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.submit(confirm);
    fireEvent.submit(confirm);
    expect(headerStatus()).toHaveTextContent("Approved"); // no optimistic change

    gate.resolve();
    expect(
      await within(region).findByText("Link applied. The internal link was successfully applied to the source page."),
    ).toBeInTheDocument();
    expect(headerStatus()).toHaveTextContent("Applied");
    expect(within(region).getByText("This link has already been applied to the source page.")).toBeInTheDocument();
    expect(within(region).getByText(/Applied at/).querySelector("time")).toHaveAttribute("datetime", "2026-09-23T13:30:00Z");
    expect(within(region).queryAllByRole("button")).toHaveLength(0); // no second Apply

    const posts = backend.posts("apply");
    expect(posts).toHaveLength(1);
    expect(posts[0].method).toBe("POST");
    expect(posts[0].init.body).toBeUndefined();
  });

  it.each([
    [409, "CONTENT_VERSION_CONFLICT", "The source page changed after this suggestion was generated. Refresh the suggestion and review it again before applying.", "status"],
    [409, "ALREADY_LINKED", "The source page already links to this target page, so no new link was added.", "status"],
    [409, "SUGGESTION_NOT_APPROVED", "Only approved suggestions can be applied. Its current status has been refreshed.", "status"],
    [409, "TARGET_NOT_LINKABLE", "The target page can no longer be linked to", "status"],
    [422, "CONTEXT_NOT_FOUND", "The original sentence for this link is no longer on the source page", "alert"],
    [422, "ANCHOR_NOT_FOUND", "The anchor text is no longer in the original sentence on the source page", "alert"],
    [422, "ANCHOR_IN_UNSAFE_ELEMENT", "where a link can't be added safely", "alert"],
  ])("explains %s %s without retrying", async (status, code, message, role) => {
    const { backend, user, region, confirm } = await openConfirm({ applyError: [status, code] });
    const detailLoads = backend.api.requests(BASE).length;

    await user.click(within(confirm).getByRole("button", { name: "Apply link" }));

    const notice = await within(region).findByText(message, { exact: false });
    expect(notice.closest(role === "alert" ? "[role=alert]" : "[role=status]")).not.toBeNull();
    expect(within(region).getByText(`${code} · HTTP ${status}`)).toBeInTheDocument();
    expect(within(region).queryByRole("form")).not.toBeInTheDocument();
    expect(backend.posts("apply")).toHaveLength(1);
    if (status === 409) await waitFor(() => expect(backend.api.requests(BASE).length).toBe(detailLoads + 1)); // refreshed
  });
});
