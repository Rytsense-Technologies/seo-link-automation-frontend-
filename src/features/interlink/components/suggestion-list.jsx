"use client";

import { isApiError } from "@/lib/api/errors";
import { Pagination } from "./pagination";
import { SuggestionCard } from "./suggestion-card";
import { BUTTON_CLASS, PANEL_CLASS } from "./suggestion-fields";

const LIST_PANEL_CLASS =
  "divide-y divide-slate-200 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200 dark:divide-slate-800 dark:bg-slate-900 dark:ring-slate-800";

export function SuggestionListSkeleton({ count = 3 }) {
  return (
    <div role="status" aria-label="Loading suggestions" className={LIST_PANEL_CLASS}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} aria-hidden="true" className="animate-pulse px-5 py-5 sm:px-6">
          <div className="flex justify-between gap-4">
            <div className="h-5 w-20 rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="h-5 w-32 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="mt-4 h-6 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="mt-4 h-16 rounded-lg bg-slate-100 dark:bg-slate-800/60" />
          <div className="mt-4 h-3.5 w-3/4 rounded bg-slate-100 dark:bg-slate-800" />
        </div>
      ))}
    </div>
  );
}

export function SuggestionListError({ error, onRetry, retrying, title = "Could not load suggestions" }) {
  const message = error instanceof Error ? error.message : "The request could not be completed.";
  return (
    <div role="alert" className="rounded-xl bg-red-50 p-5 ring-1 ring-red-200 dark:bg-red-950/40 dark:ring-red-900">
      <h3 className="text-sm font-semibold text-red-900 dark:text-red-200">{title}</h3>
      <p className="mt-1 text-sm text-red-800 dark:text-red-300">{message}</p>
      {isApiError(error) && (
        <p className="mt-1 font-mono text-xs text-red-700 dark:text-red-400">
          {error.code} · HTTP {error.status}
        </p>
      )}
      <button type="button" className={`${BUTTON_CLASS} mt-4`} onClick={onRetry} disabled={retrying}>
        {retrying ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}

/**
 * One backend page of suggestions. `data` is the list response; `isUpdating` means it is the
 * previous result, kept on screen while the next filter/page loads. `detailHref(id)` builds the
 * detail URL carrying the list filters, and `sourcePages` maps already-loaded page ids to pages.
 * `headingLevel` is the level of each suggestion's heading.
 */
export function SuggestionList({
  data,
  isUpdating,
  filtersActive,
  detailHref,
  sourcePages,
  headingLevel = 3,
  onClearFilters,
  onPageChange,
  onPageSizeChange,
}) {
  if (data.items.length === 0) {
    // A page number past the end (e.g. a stale shared link) is not the same as "nothing matches".
    if (data.total > 0) {
      return (
        <div className={`${PANEL_CLASS} text-center`}>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">This page has no suggestions.</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            There are {data.total} matching suggestions on earlier pages.
          </p>
          <button type="button" className={`${BUTTON_CLASS} mt-4`} onClick={() => onPageChange(1)}>
            Go to first page
          </button>
        </div>
      );
    }
    return (
      <div className={`${PANEL_CLASS} py-12 text-center`}>
        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">No interlink suggestions found.</p>
        {filtersActive && (
          <>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Try removing some filters.</p>
            <button type="button" className={`${BUTTON_CLASS} mt-4`} onClick={onClearFilters}>
              Clear filters
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul
        aria-label="Interlink suggestions"
        aria-busy={isUpdating}
        className={`${LIST_PANEL_CLASS} transition-opacity ${isUpdating ? "opacity-60" : ""}`}
      >
        {data.items.map((suggestion) => (
          <li key={suggestion.id}>
            <SuggestionCard
              suggestion={suggestion}
              href={detailHref(suggestion.id)}
              sourcePage={sourcePages?.get(suggestion.source_page_id)}
              headingLevel={headingLevel}
            />
          </li>
        ))}
      </ul>
      <Pagination
        page={data.page}
        pageSize={data.page_size}
        total={data.total}
        itemCount={data.items.length}
        busy={isUpdating}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}
