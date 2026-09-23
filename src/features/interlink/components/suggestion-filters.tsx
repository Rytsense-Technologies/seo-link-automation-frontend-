"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { useInterlinkPages } from "../hooks/use-interlink-pages";
import { useInterlinkSites } from "../hooks/use-interlink-sites";
import { hasActiveFilters, parseMinScore, type FilterPatch, type SuggestionFilters } from "../lib/url-filters";
import { SUGGESTION_STATUSES, isSuggestionStatus } from "../types/suggestions";
import { BUTTON_CLASS } from "./pagination";

/** Typing pauses this long before the minimum score is applied (Enter or blur applies at once). */
export const MIN_SCORE_DEBOUNCE_MS = 500;

const CONTROL_CLASS =
  "h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 shadow-xs focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 aria-[invalid=true]:border-red-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800";

const LINK_BUTTON_CLASS =
  "rounded text-xs font-medium text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline dark:text-blue-300";

function FilterField({ id, label, children, hint }: { id: string; label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-slate-600 dark:text-slate-400">
        {label}
      </label>
      {children}
      {hint}
    </div>
  );
}

function pagePath(url: string): string {
  try {
    const { pathname, search } = new URL(url);
    return `${pathname}${search}`;
  } catch {
    return url;
  }
}

function SiteSelect({ value, onChange }: { value: string | null; onChange: (siteId: string | null) => void }) {
  const id = useId();
  const sites = useInterlinkSites();
  const known = sites.data?.some((site) => site.id === value) ?? false;

  return (
    <FilterField
      id={id}
      label="Site"
      hint={
        sites.isError && (
          <p className="text-xs text-red-700 dark:text-red-400" role="alert">
            Sites could not be loaded.{" "}
            <button type="button" className={LINK_BUTTON_CLASS} onClick={() => void sites.refetch()}>
              Retry
            </button>
          </p>
        )
      }
    >
      <select
        id={id}
        className={CONTROL_CLASS}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        disabled={sites.isPending && value === null}
      >
        <option value="">{sites.isPending ? "Loading sites…" : "All sites"}</option>
        {value && !known && <option value={value}>{sites.isPending ? "Loading…" : `Unknown site (${value})`}</option>}
        {sites.data?.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
      </select>
    </FilterField>
  );
}

function SourcePageSelect({
  siteId,
  value,
  onChange,
}: {
  siteId: string | null;
  value: string | null;
  onChange: (pageId: string | null) => void;
}) {
  const id = useId();
  const hintId = useId();
  const pages = useInterlinkPages(siteId);
  const loaded = pages.data?.pages.flatMap((page) => page.items) ?? [];
  const total = pages.data?.pages[0]?.total ?? 0;
  const known = loaded.some((page) => page.id === value);

  let hint: ReactNode;
  if (siteId === null) {
    hint = "Choose a site to list its pages.";
  } else if (pages.isError) {
    hint = (
      <span role="alert" className="text-red-700 dark:text-red-400">
        Pages could not be loaded.{" "}
        <button type="button" className={LINK_BUTTON_CLASS} onClick={() => void pages.refetch()}>
          Retry
        </button>
      </span>
    );
  } else if (pages.data) {
    hint = (
      <>
        {loaded.length} of {total} pages loaded
        {pages.hasNextPage && (
          <>
            {" · "}
            <button
              type="button"
              className={LINK_BUTTON_CLASS}
              onClick={() => void pages.fetchNextPage()}
              disabled={pages.isFetchingNextPage}
            >
              {pages.isFetchingNextPage ? "Loading…" : "Load more pages"}
            </button>
          </>
        )}
      </>
    );
  }

  return (
    <FilterField
      id={id}
      label="Source page"
      hint={
        <p id={hintId} className="text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      }
    >
      <select
        id={id}
        className={CONTROL_CLASS}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        disabled={siteId === null && value === null}
        aria-describedby={hintId}
      >
        <option value="">{siteId && pages.isPending ? "Loading pages…" : "All source pages"}</option>
        {value && !known && <option value={value}>Selected page ({value})</option>}
        {loaded.map((page) => (
          <option key={page.id} value={page.id} title={page.title ?? page.url}>
            {pagePath(page.url)}
          </option>
        ))}
      </select>
    </FilterField>
  );
}

function MinScoreInput({ value, onCommit }: { value: number | null; onCommit: (score: number | null) => void }) {
  const id = useId();
  const errorId = useId();
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  const [lastValue, setLastValue] = useState(value);

  // The URL changed underneath us (back/forward, clear filters): show the new value.
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value === null ? "" : String(value));
  }

  const trimmed = draft.trim();
  const parsed = parseMinScore(trimmed);
  const invalid = trimmed !== "" && parsed === null;

  const commit = () => {
    if (invalid) return;
    if (parsed !== value) onCommit(parsed);
  };

  useEffect(() => {
    if (invalid || parsed === value) return;
    const timer = window.setTimeout(() => onCommit(parsed), MIN_SCORE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [invalid, parsed, value, onCommit]);

  return (
    <FilterField
      id={id}
      label="Min. relevance score"
      hint={
        invalid && (
          <p id={errorId} className="text-xs text-red-700 dark:text-red-400">
            Enter a whole number from 0 to 100.
          </p>
        )
      }
    >
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={100}
        step={1}
        placeholder="0–100"
        className={CONTROL_CLASS}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
        aria-invalid={invalid}
        {...(invalid ? { "aria-describedby": errorId } : {})}
      />
    </FilterField>
  );
}

export interface SuggestionFiltersProps {
  filters: SuggestionFilters;
  onChange: (patch: FilterPatch) => void;
  onClear: () => void;
}

export function SuggestionFiltersBar({ filters, onChange, onClear }: SuggestionFiltersProps) {
  const statusId = useId();

  return (
    <section
      aria-label="Filters"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1.5fr)_9rem_auto]">
        <FilterField id={statusId} label="Status">
          <select
            id={statusId}
            className={CONTROL_CLASS}
            value={filters.status ?? ""}
            onChange={(event) => onChange({ status: isSuggestionStatus(event.target.value) ? event.target.value : null })}
          >
            <option value="">All</option>
            {SUGGESTION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </FilterField>

        <SiteSelect value={filters.site_id} onChange={(siteId) => onChange({ site_id: siteId })} />

        <SourcePageSelect
          siteId={filters.site_id}
          value={filters.source_page_id}
          onChange={(pageId) => onChange({ source_page_id: pageId })}
        />

        <MinScoreInput value={filters.min_relevance_score} onCommit={(score) => onChange({ min_relevance_score: score })} />

        <div className="flex h-full items-start sm:col-span-2 lg:col-span-1 lg:pt-5">
          <button type="button" className={BUTTON_CLASS} onClick={onClear} disabled={!hasActiveFilters(filters)}>
            Clear filters
          </button>
        </div>
      </div>
    </section>
  );
}
