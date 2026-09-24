"use client";

import { useId } from "react";
import { PAGE_SIZE_OPTIONS } from "../lib/url-filters";
import { BUTTON_CLASS } from "./suggestion-fields";

/**
 * `itemCount` is the number of items on this page (0 when the URL points past the last page).
 * `busy` means the next page is loading; navigation waits so it never acts on the previous result.
 */
export function Pagination({ page, pageSize, total, itemCount, busy = false, onPageChange, onPageSizeChange }) {
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
          className="min-h-10 rounded-lg border-0 bg-white px-2.5 text-sm text-slate-900 shadow-xs ring-1 ring-slate-300 ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <button type="button" className={BUTTON_CLASS} disabled={busy || !hasPrevious} onClick={() => onPageChange(page - 1)}>
          <span aria-hidden="true">←</span>Previous
        </button>
        <span className="px-1 text-sm text-slate-600 tabular-nums dark:text-slate-400">Page {page}</span>
        <button type="button" className={BUTTON_CLASS} disabled={busy || !hasNext} onClick={() => onPageChange(page + 1)}>
          Next<span aria-hidden="true">→</span>
        </button>
      </div>
    </nav>
  );
}
