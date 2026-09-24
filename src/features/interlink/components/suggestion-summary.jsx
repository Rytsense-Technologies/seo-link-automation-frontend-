"use client";

import { useSuggestionCounts } from "../hooks/use-suggestion-counts";
import { STATUS_LABELS, SUGGESTION_STATUSES } from "../lib/suggestion-status";

const ACCENTS = {
  PENDING: "bg-amber-400",
  APPROVED: "bg-emerald-500",
  REJECTED: "bg-red-500",
  APPLIED: "bg-blue-500",
};

/**
 * Suggestions per status for the current site / source page / minimum score, straight from the
 * backend's totals. Each tile is also a toggle for the status filter.
 */
export function SuggestionSummary({ filters, onSelectStatus }) {
  const { counts, isError } = useSuggestionCounts(filters);

  return (
    <section aria-labelledby="summary-heading">
      <h3 id="summary-heading" className="sr-only">
        Suggestions by status
      </h3>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SUGGESTION_STATUSES.map((status) => {
          const count = counts[status];
          const selected = filters.status === status;
          const countText = count ?? (isError ? "unavailable" : "loading");
          return (
            <li key={status}>
              <button
                type="button"
                aria-pressed={selected}
                aria-label={`${STATUS_LABELS[status]} suggestions: ${countText}`}
                onClick={() => onSelectStatus(selected ? null : status)}
                className={`flex w-full flex-col items-start rounded-xl bg-white p-4 text-left shadow-sm ring-1 transition hover:ring-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-slate-900 dark:hover:ring-slate-700 ${
                  selected ? "ring-2 ring-blue-600 dark:ring-blue-400" : "ring-slate-200 dark:ring-slate-800"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                  <span aria-hidden="true" className={`h-2 w-2 rounded-full ${ACCENTS[status]}`} />
                  {STATUS_LABELS[status]}
                </span>
                <span className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums dark:text-slate-50">
                  {count ?? "—"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
