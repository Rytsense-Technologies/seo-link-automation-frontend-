"use client";

import { useEffect, useId, useRef, useState } from "react";
import { isApiError } from "@/lib/api/errors";
import { useApplySuggestion } from "../hooks/use-apply-suggestion";
import { useApproveSuggestion } from "../hooks/use-approve-suggestion";
import { REJECTION_REASON_MAX_LENGTH, reasonLength, useRejectSuggestion } from "../hooks/use-reject-suggestion";
import { describeApplyError } from "../lib/error-messages";
import { availableReviewActions } from "../lib/review-actions";
import {
  BUTTON_CLASS,
  DANGER_BUTTON_CLASS,
  DANGER_OUTLINE_BUTTON_CLASS,
  DateValue,
  PANEL_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "./suggestion-fields";
import { SuggestionStatusBadge } from "./suggestion-status-badge";

/** What the current status means for the reviewer. */
const STATUS_MESSAGES = {
  PENDING: "This suggestion is waiting for your review.",
  APPROVED: "This suggestion is approved and ready to be applied.",
  REJECTED: "This suggestion has been rejected.",
  APPLIED: "This link has already been applied to the source page.",
};

const SUCCESS_MESSAGES = {
  approve: "Suggestion approved.",
  reject: "Suggestion rejected.",
  apply: "Link applied. The internal link was successfully applied to the source page.",
};

const HELP_TEXT_CLASS = "mt-1.5 text-sm text-slate-500 dark:text-slate-400";
const INLINE_PANEL_CLASS = "mt-5 rounded-lg p-4 ring-1";

function describeFailure(action, error) {
  if (action === "apply") {
    const { message, code } = describeApplyError(error);
    return { conflict: isApiError(error) && error.kind === "conflict", text: message, code };
  }
  if (isApiError(error) && error.kind === "conflict") {
    const current = typeof error.details?.current_status === "string" ? ` (it is now ${error.details.current_status})` : "";
    return {
      conflict: true,
      text: `This suggestion was already updated${current}. Its current status has been refreshed.`,
      code: null,
    };
  }
  return {
    conflict: false,
    text: `Could not ${action} the suggestion. ${error instanceof Error ? error.message : ""}`.trim(),
    code: isApiError(error) ? `${error.code} · HTTP ${error.status}` : null,
  };
}

const pageName = (page) => page.title ?? page.url;

/**
 * Approve / reject / apply controls for one suggestion. The backend is the authority on
 * transitions: nothing changes on screen until it confirms, and a 409 refreshes the suggestion
 * instead of failing silently. Applying changes the source page's content, so it always needs an
 * explicit confirmation and is never retried automatically.
 */
export function SuggestionReviewActions({ suggestion }) {
  const approve = useApproveSuggestion(suggestion.id);
  const reject = useRejectSuggestion(suggestion.id);
  const apply = useApplySuggestion(suggestion.id);
  const mutations = { approve, reject, apply };
  const [lastAction, setLastAction] = useState(null);
  const [openPanel, setOpenPanel] = useState(null); // "reject" | "apply" | null
  const [reason, setReason] = useState("");

  const headingId = useId();
  const rejectHeadingId = useId();
  const applyHeadingId = useId();
  const reasonId = useId();
  const counterId = useId();
  const approveHelpId = useId();
  const rejectHelpId = useId();
  const applyHelpId = useId();
  const headingRef = useRef(null);
  const textareaRef = useRef(null);
  const togglesRef = useRef({});

  const busy = approve.isPending || reject.isPending || apply.isPending;
  const actions = availableReviewActions(suggestion.status);
  const length = reasonLength(reason);
  const tooLong = length > REJECTION_REASON_MAX_LENGTH;

  const active = lastAction ? mutations[lastAction] : null;
  const failure = active?.isError ? describeFailure(lastAction, active.error) : null;
  const outcome = active && (active.isSuccess || active.isError) ? `${lastAction}:${active.status}` : null;

  // Focus follows the outcome: back into the reject form if it is still open, otherwise to the
  // panel heading, since the button that was pressed may no longer exist.
  useEffect(() => {
    if (!outcome) return;
    if (openPanel === "reject") textareaRef.current?.focus();
    else headingRef.current?.focus();
  }, [outcome, openPanel]);

  const resetAll = () => {
    approve.reset();
    reject.reset();
    apply.reset();
    setLastAction(null);
  };

  const openInlinePanel = (panel) => {
    resetAll();
    setOpenPanel(panel);
  };

  const closePanel = () => {
    if (busy) return;
    const closing = openPanel;
    setOpenPanel(null);
    setReason("");
    reject.reset();
    // Wait for the button that opened the panel to be rendered again before focusing it.
    requestAnimationFrame(() => togglesRef.current[closing]?.focus());
  };

  const handleApprove = () => {
    if (busy) return;
    resetAll();
    setLastAction("approve");
    approve.mutate();
  };

  const handleReject = (event) => {
    event.preventDefault();
    if (busy || tooLong) return;
    approve.reset();
    apply.reset();
    setLastAction("reject");
    reject.mutate(reason.trim() || null, {
      onSuccess: () => {
        setOpenPanel(null);
        setReason("");
      },
      onError: (error) => {
        // The status changed underneath us; the refreshed actions replace this form.
        if (isApiError(error) && error.kind === "conflict") setOpenPanel(null);
      },
    });
  };

  const handleApply = (event) => {
    event.preventDefault();
    if (busy) return;
    approve.reset();
    reject.reset();
    setLastAction("apply");
    // Success or failure, the confirmation closes: applying is never retried from here.
    apply.mutate(undefined, { onSettled: () => setOpenPanel(null) });
  };

  const onPanelKeyDown = (event) => {
    if (event.key === "Escape" && !busy) {
      event.stopPropagation();
      closePanel();
    }
  };

  const showButtons = openPanel === null && (actions.approve || actions.reject || actions.apply);

  return (
    <section aria-labelledby={headingId} className={`${PANEL_CLASS} ring-2 ring-slate-200 dark:ring-slate-700`}>
      <h2
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
        className="w-fit rounded text-base font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-slate-100"
      >
        Review decision
      </h2>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <SuggestionStatusBadge status={suggestion.status} size="lg" />
      </div>
      <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{STATUS_MESSAGES[suggestion.status]}</p>
      {suggestion.status === "APPLIED" && suggestion.applied_at && (
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
          Applied at <DateValue value={suggestion.applied_at} />
        </p>
      )}

      <div role="status" className="mt-3 text-sm empty:hidden">
        {active?.isSuccess && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100">
            <span aria-hidden="true">✓ </span>
            {SUCCESS_MESSAGES[lastAction]}
          </p>
        )}
        {failure?.conflict && (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
            <p>{failure.text}</p>
            {failure.code && <p className="mt-1 font-mono text-xs">{failure.code}</p>}
          </div>
        )}
      </div>
      {failure && !failure.conflict && (
        <div role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm ring-1 ring-red-200 dark:bg-red-950/40 dark:ring-red-900">
          <p className="text-red-800 dark:text-red-300">{failure.text}</p>
          {failure.code && <p className="mt-1 font-mono text-xs text-red-700 dark:text-red-400">{failure.code}</p>}
        </div>
      )}

      {showButtons && (
        <div className="mt-5 flex flex-col gap-4">
          {actions.apply && (
            <div>
              <button
                ref={(node) => {
                  togglesRef.current.apply = node;
                }}
                type="button"
                className={`${PRIMARY_BUTTON_CLASS} w-full`}
                onClick={() => openInlinePanel("apply")}
                disabled={busy}
                aria-describedby={applyHelpId}
              >
                Apply link
              </button>
              <p id={applyHelpId} className={HELP_TEXT_CLASS}>
                Inserts this link into the source page. You&apos;ll be asked to confirm first.
              </p>
            </div>
          )}
          {actions.approve && (
            <div>
              <button
                type="button"
                className={`${PRIMARY_BUTTON_CLASS} w-full`}
                onClick={handleApprove}
                disabled={busy}
                aria-describedby={approveHelpId}
              >
                {approve.isPending ? "Approving…" : "Approve suggestion"}
              </button>
              <p id={approveHelpId} className={HELP_TEXT_CLASS}>
                Approve this suggestion to make it available for applying to the source page.
              </p>
            </div>
          )}
          {actions.reject && (
            <div>
              <button
                ref={(node) => {
                  togglesRef.current.reject = node;
                }}
                type="button"
                className={`${DANGER_OUTLINE_BUTTON_CLASS} w-full`}
                onClick={() => openInlinePanel("reject")}
                disabled={busy}
                aria-describedby={rejectHelpId}
              >
                Reject suggestion
              </button>
              <p id={rejectHelpId} className={HELP_TEXT_CLASS}>
                Reject this suggestion if the link is not relevant or useful.
              </p>
            </div>
          )}
        </div>
      )}

      {openPanel === "apply" && actions.apply && (
        <form
          aria-labelledby={applyHeadingId}
          onSubmit={handleApply}
          onKeyDown={onPanelKeyDown}
          className={`${INLINE_PANEL_CLASS} bg-blue-50/60 ring-blue-200 dark:bg-blue-500/10 dark:ring-blue-900`}
        >
          <h3 id={applyHeadingId} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Apply this internal link?
          </h3>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <div>
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Source</dt>
              <dd className="break-words text-slate-900 dark:text-slate-100">{pageName(suggestion.source_page)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Anchor</dt>
              <dd className="font-semibold break-words text-slate-900 dark:text-slate-100">“{suggestion.anchor_text}”</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Target</dt>
              <dd className="break-words text-slate-900 dark:text-slate-100">{pageName(suggestion.target_page)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-200">This will modify the source page content.</p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {/* Cancel takes focus first, so a stray Enter never applies the link. */}
            <button type="button" autoFocus className={BUTTON_CLASS} onClick={closePanel} disabled={apply.isPending}>
              Cancel
            </button>
            <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={apply.isPending}>
              {apply.isPending ? "Applying…" : "Apply link"}
            </button>
          </div>
        </form>
      )}

      {openPanel === "reject" && actions.reject && (
        <form
          aria-labelledby={rejectHeadingId}
          onSubmit={handleReject}
          onKeyDown={onPanelKeyDown}
          className={`${INLINE_PANEL_CLASS} bg-red-50/60 ring-red-200 dark:bg-red-950/20 dark:ring-red-900`}
        >
          <h3 id={rejectHeadingId} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Why are you rejecting this suggestion?
          </h3>
          <label htmlFor={reasonId} className="mt-3 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Reason (optional)
          </label>
          <textarea
            id={reasonId}
            ref={textareaRef}
            autoFocus
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={reject.isPending}
            aria-invalid={tooLong}
            aria-describedby={counterId}
            placeholder="For example: the target page is not related to this sentence."
            className="mt-1.5 block w-full resize-y rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs ring-1 ring-slate-300 ring-inset placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-100 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-500 dark:bg-slate-950 dark:text-slate-100 dark:ring-slate-700 dark:disabled:bg-slate-800"
          />
          <p
            id={counterId}
            className={`mt-1.5 text-xs tabular-nums ${tooLong ? "font-medium text-red-700 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}
          >
            {length} / {REJECTION_REASON_MAX_LENGTH}
            {tooLong && ` — the reason must be ${REJECTION_REASON_MAX_LENGTH} characters or fewer.`}
          </p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" className={BUTTON_CLASS} onClick={closePanel} disabled={reject.isPending}>
              Cancel
            </button>
            <button type="submit" className={DANGER_BUTTON_CLASS} disabled={reject.isPending || tooLong}>
              {reject.isPending ? "Rejecting…" : "Reject suggestion"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
