"use client";

import { useId } from "react";
import { PAGE_SIZE_OPTIONS } from "../lib/url-filters";

export const BUTTON_CLASS =
  "inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 shadow-xs hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:disabled:hover:bg-slate-900";

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  /** Items on the current page (can be 0 when the URL points past the last page). */
  itemCount: number;
  /** The next page is loading; navigation waits so it never acts on the previous result. */
  busy?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function Pagination({ page, pageSize, total, itemCount, busy = false, onPageChange, onPageSizeChange }: PaginationProps) {
  const sizeId = useId();
  const first = itemCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = itemCount === 0 ? 0 : (page - 1) * pageSize + itemCount;
  const hasPrevious = page > 1;
  const hasNext = page * pageSize < total;

  return (
    <nav aria-label="Suggestion pages" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-600 tabular-nums dark:text-slate-400" aria-live="polite">
        Showing {first}–{last} of {total}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={sizeId} className="text-sm text-slate-600 dark:text-slate-400">
          Per page
        </label>
        <select
          id={sizeId}
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <button type="button" className={BUTTON_CLASS} disabled={busy || !hasPrevious} onClick={() => onPageChange(page - 1)}>
          <span aria-hidden="true">←&nbsp;</span>Previous
        </button>
        <span className="px-1 text-sm text-slate-600 tabular-nums dark:text-slate-400">Page {page}</span>
        <button type="button" className={BUTTON_CLASS} disabled={busy || !hasNext} onClick={() => onPageChange(page + 1)}>
          Next<span aria-hidden="true">&nbsp;→</span>
        </button>
      </div>
    </nav>
  );
}
