"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { isApiError } from "@/lib/api/errors";
import { useApproveSuggestion } from "../hooks/use-approve-suggestion";
import { REJECTION_REASON_MAX_LENGTH, reasonLength, useRejectSuggestion } from "../hooks/use-reject-suggestion";
import { availableReviewActions } from "../lib/review-actions";
import type { SuggestionDetail } from "../types/suggestions";
import { BUTTON_CLASS } from "./pagination";
import { PANEL_CLASS } from "./suggestion-fields";
import { SuggestionStatusBadge } from "./suggestion-status-badge";

const BUTTON_BASE =
  "inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY_BUTTON = `${BUTTON_BASE} bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline-blue-600 disabled:hover:bg-blue-600`;
const DANGER_OUTLINE_BUTTON = `${BUTTON_BASE} border border-red-300 bg-white text-red-700 hover:bg-red-50 focus-visible:outline-red-600 disabled:hover:bg-white dark:border-red-800 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950 dark:disabled:hover:bg-slate-900`;
const DANGER_BUTTON = `${BUTTON_BASE} bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600 disabled:hover:bg-red-600`;

type Action = "approve" | "reject";

function describeFailure(action: Action, error: unknown): { conflict: boolean; text: string; code: string | null } {
  if (isApiError(error) && error.kind === "conflict") {
    const details = error.details as { current_status?: unknown } | undefined;
    const current = typeof details?.current_status === "string" ? ` (it is now ${details.current_status})` : "";
    return {
      conflict: true,
      text: `This suggestion was already updated${current}. Its current status has been refreshed.`,
      code: null,
    };
  }
  const verb = action === "approve" ? "approve" : "reject";
  return {
    conflict: false,
    text: `Could not ${verb} the suggestion. ${error instanceof Error ? error.message : ""}`.trim(),
    code: isApiError(error) ? `${error.code} · HTTP ${error.status}` : null,
  };
}

/**
 * Approve / reject controls for one suggestion. The backend is the authority on transitions:
 * nothing changes on screen until it confirms, and a 409 refreshes the suggestion instead of
 * failing silently.
 */
export function SuggestionReviewActions({ suggestion }: { suggestion: SuggestionDetail }) {
  const approve = useApproveSuggestion(suggestion.id);
  const reject = useRejectSuggestion(suggestion.id);
  const [lastAction, setLastAction] = useState<Action | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  const headingId = useId();
  const panelHeadingId = useId();
  const reasonId = useId();
  const counterId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rejectToggleRef = useRef<HTMLButtonElement>(null);

  const busy = approve.isPending || reject.isPending;
  const actions = availableReviewActions(suggestion.status);
  const length = reasonLength(reason);
  const tooLong = length > REJECTION_REASON_MAX_LENGTH;

  const active = lastAction === "approve" ? approve : lastAction === "reject" ? reject : null;
  const failure = active?.isError ? describeFailure(lastAction as Action, active.error) : null;
  const outcome = active && (active.isSuccess || active.isError) ? `${lastAction}:${active.status}` : null;

  // Focus follows the outcome: back into the reject form if it is still open, otherwise to the
  // section heading, since the button that was pressed may no longer exist.
  useEffect(() => {
    if (!outcome) return;
    if (rejectOpen) textareaRef.current?.focus();
    else headingRef.current?.focus();
  }, [outcome, rejectOpen]);

  const openReject = () => {
    approve.reset();
    reject.reset();
    setLastAction(null);
    setRejectOpen(true);
  };

  const closeReject = () => {
    if (reject.isPending) return;
    setRejectOpen(false);
    setReason("");
    reject.reset();
    // Wait for the toggle to be rendered again before focusing it.
    requestAnimationFrame(() => rejectToggleRef.current?.focus());
  };

  const handleApprove = () => {
    if (busy) return;
    reject.reset();
    setLastAction("approve");
    approve.mutate();
  };

  const handleReject = (event: FormEvent) => {
    event.preventDefault();
    if (busy || tooLong) return;
    approve.reset();
    setLastAction("reject");
    reject.mutate(reason.trim() || null, {
      onSuccess: () => {
        setRejectOpen(false);
        setReason("");
      },
      onError: (error) => {
        // The status changed underneath us; the refreshed actions replace this form.
        if (isApiError(error) && error.kind === "conflict") setRejectOpen(false);
      },
    });
  };

  const onPanelKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && !reject.isPending) {
      event.stopPropagation();
      closeReject();
    }
  };

  return (
    <section aria-labelledby={headingId} className={PANEL_CLASS}>
      <h2
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
        className="w-fit rounded text-sm font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-slate-100"
      >
        Review actions
      </h2>

      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        Current status <SuggestionStatusBadge status={suggestion.status} />
      </p>

      <div role="status" className="empty:hidden mt-3 text-sm">
        {active?.isSuccess && (
          <p className="text-slate-800 dark:text-slate-200">
            {lastAction === "approve" ? "Suggestion approved." : "Suggestion rejected."}
          </p>
        )}
        {failure?.conflict && <p className="text-slate-800 dark:text-slate-200">{failure.text}</p>}
      </div>
      {failure && !failure.conflict && (
        <div role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/40">
          <p className="text-red-800 dark:text-red-300">{failure.text}</p>
          {failure.code && <p className="mt-1 font-mono text-xs text-red-700 dark:text-red-400">{failure.code}</p>}
        </div>
      )}

      {suggestion.status === "APPLIED" ? (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          This suggestion has been applied. No review actions are available.
        </p>
      ) : (
        !rejectOpen && (
          <div className="mt-4 flex flex-wrap gap-2">
            {actions.approve && (
              <button type="button" className={PRIMARY_BUTTON} onClick={handleApprove} disabled={busy}>
                {approve.isPending ? "Approving…" : "Approve"}
              </button>
            )}
            {actions.reject && (
              <button ref={rejectToggleRef} type="button" className={DANGER_OUTLINE_BUTTON} onClick={openReject} disabled={busy}>
                Reject
              </button>
            )}
          </div>
        )
      )}

      {rejectOpen && actions.reject && (
        <form
          aria-labelledby={panelHeadingId}
          onSubmit={handleReject}
          onKeyDown={onPanelKeyDown}
          className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40"
        >
          <h3 id={panelHeadingId} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Reject suggestion
          </h3>
          <label htmlFor={reasonId} className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-400">
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
            className="mt-1 block w-full resize-y rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 shadow-xs focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-100 aria-[invalid=true]:border-red-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800"
          />
          <p
            id={counterId}
            className={`mt-1 text-xs tabular-nums ${tooLong ? "text-red-700 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}
          >
            {length} / {REJECTION_REASON_MAX_LENGTH}
            {tooLong && ` — the reason must be ${REJECTION_REASON_MAX_LENGTH} characters or fewer.`}
          </p>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button type="button" className={BUTTON_CLASS} onClick={closeReject} disabled={reject.isPending}>
              Cancel
            </button>
            <button type="submit" className={DANGER_BUTTON} disabled={reject.isPending || tooLong}>
              {reject.isPending ? "Rejecting…" : "Reject"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
