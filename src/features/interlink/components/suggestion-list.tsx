"use client";

import { isApiError } from "@/lib/api/errors";
import type { SuggestionList as SuggestionListData } from "../types/suggestions";
import { BUTTON_CLASS, Pagination } from "./pagination";
import { SuggestionCard } from "./suggestion-card";

const PANEL_CLASS =
  "rounded-lg border border-slate-200 bg-white px-6 py-10 text-center dark:border-slate-800 dark:bg-slate-900";

export function SuggestionListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading suggestions" className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="animate-pulse rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex justify-between gap-4">
            <div className="h-5 w-1/3 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-5 w-32 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3.5 w-full rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-3.5 w-11/12 rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-3.5 w-2/3 rounded bg-slate-100 dark:bg-slate-800" />
          </div>
          <div className="mt-4 h-3.5 w-3/4 rounded bg-slate-100 dark:bg-slate-800" />
        </div>
      ))}
    </div>
  );
}

export function SuggestionListError({ error, onRetry, retrying }: { error: unknown; onRetry: () => void; retrying: boolean }) {
  const message = error instanceof Error ? error.message : "The suggestions could not be loaded.";
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/40">
      <h3 className="text-sm font-semibold text-red-900 dark:text-red-200">Could not load suggestions</h3>
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

export interface SuggestionListProps {
  data: SuggestionListData;
  /** Showing the previous result while the next filter/page loads. */
  isUpdating: boolean;
  filtersActive: boolean;
  onClearFilters: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function SuggestionList({
  data,
  isUpdating,
  filtersActive,
  onClearFilters,
  onPageChange,
  onPageSizeChange,
}: SuggestionListProps) {
  if (data.items.length === 0) {
    // A page number past the end (e.g. a stale shared link) is not the same as "nothing matches".
    if (data.total > 0) {
      return (
        <div className={PANEL_CLASS}>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">This page has no suggestions.</p>
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
      <div className={PANEL_CLASS}>
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">No interlink suggestions found.</p>
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
        className={`flex flex-col gap-3 transition-opacity ${isUpdating ? "opacity-60" : ""}`}
      >
        {data.items.map((suggestion) => (
          <li key={suggestion.id}>
            <SuggestionCard suggestion={suggestion} />
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
