"use client";

import { useMemo, useState } from "react";
import { useInterlinkPages } from "../hooks/use-interlink-pages";
import { useInterlinkSuggestions } from "../hooks/use-interlink-suggestions";
import { useSuggestionFilters } from "../hooks/use-suggestion-filters";
import { DEFAULT_PAGE_SIZE, hasActiveFilters, serializeFilters, suggestionDetailHref } from "../lib/url-filters";
import { AnalysisResults } from "./analysis-results";
import { AnalyzePanel } from "./analyze-panel";
import { SuggestionFiltersBar } from "./suggestion-filters";
import { SuggestionList, SuggestionListError, SuggestionListSkeleton } from "./suggestion-list";
import { SuggestionSummary } from "./suggestion-summary";

/**
 * The previously generated suggestions, filterable and paginated by the backend. Secondary to
 * the analysis above it.
 */
function SuggestionHistory({ filters, setFilters, resetFilters, detailHref }) {
  const suggestions = useInterlinkSuggestions(filters);
  const filtersActive = hasActiveFilters(filters);
  const isUpdating = suggestions.isPlaceholderData && suggestions.isFetching;

  // The same query (and cache entry) as the source-page filter, so this never adds a request:
  // cards show a source page's URL whenever its page is already loaded for the selected site.
  const pages = useInterlinkPages(filters.site_id);
  const sourcePages = useMemo(
    () => new Map((pages.data?.pages ?? []).flatMap((page) => page.items).map((page) => [page.id, page])),
    [pages.data],
  );

  let content;
  if (suggestions.isPending) {
    content = <SuggestionListSkeleton />;
  } else if (suggestions.isError) {
    content = (
      <SuggestionListError
        error={suggestions.error}
        onRetry={() => void suggestions.refetch()}
        retrying={suggestions.isFetching}
      />
    );
  } else {
    content = (
      <SuggestionList
        data={suggestions.data}
        isUpdating={isUpdating}
        filtersActive={filtersActive}
        detailHref={detailHref}
        sourcePages={sourcePages}
        headingLevel={4}
        onClearFilters={resetFilters}
        onPageChange={(page) => setFilters({ page })}
        onPageSizeChange={(pageSize) => setFilters({ page_size: pageSize })}
      />
    );
  }

  return (
    <section aria-labelledby="history-heading" className="flex flex-col gap-5 border-t border-slate-200 pt-8 dark:border-slate-800">
      <div>
        <h2 id="history-heading" className="text-xl font-semibold text-slate-900 dark:text-slate-50">
          Suggestion history
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Every suggestion generated so far, across all analyzed pages.
        </p>
      </div>
      <SuggestionSummary filters={filters} onSelectStatus={(status) => setFilters({ status })} />
      <SuggestionFiltersBar filters={filters} onChange={setFilters} onClear={resetFilters} />
      <section aria-labelledby="suggestions-heading" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="suggestions-heading" className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Suggestions
            {suggestions.data && (
              <span className="ml-2 text-sm font-normal text-slate-500 tabular-nums dark:text-slate-400">
                {suggestions.data.total} total
              </span>
            )}
          </h3>
          <p role="status" className="text-sm text-slate-500 dark:text-slate-400">
            {isUpdating ? "Updating results…" : ""}
          </p>
        </div>
        {content}
      </section>
    </section>
  );
}

/**
 * The Internal Link Automation workspace: analyze a page by URL, review what was found, and
 * (below) browse the suggestion history. The analysed page and the history filters all live in
 * the address bar, so refresh, sharing and "back" keep the reviewer's place.
 */
export function InterlinkPage() {
  const { filters, setFilters, resetFilters } = useSuggestionFilters();
  const detailHref = (suggestionId) => suggestionDetailHref(suggestionId, serializeFilters(filters));
  const [historyRequested, setHistoryRequested] = useState(false);

  // While an analysis is on screen the history stays folded away (and loads nothing) unless the
  // reviewer opens it or the address bar already carries history filters.
  const historyInUse = hasActiveFilters(filters) || filters.page !== 1 || filters.page_size !== DEFAULT_PAGE_SIZE;
  const historyOpen = !filters.url || historyInUse || historyRequested;

  return (
    <div className="flex flex-col gap-8">
      <AnalyzePanel currentUrl={filters.url} onAnalyzed={(url) => setFilters({ url })} />
      {filters.url && (
        <AnalysisResults url={filters.url} detailHref={detailHref} onNewAnalysis={() => setFilters({ url: null })} />
      )}
      {historyOpen ? (
        <SuggestionHistory filters={filters} setFilters={setFilters} resetFilters={resetFilters} detailHref={detailHref} />
      ) : (
        <section aria-labelledby="history-heading" className="border-t border-slate-200 pt-8 dark:border-slate-800">
          <h2 id="history-heading" className="text-xl font-semibold text-slate-900 dark:text-slate-50">
            Suggestion history
          </h2>
          <button
            type="button"
            aria-expanded="false"
            onClick={() => setHistoryRequested(true)}
            className="mt-3 inline-flex min-h-10 items-center rounded text-sm font-semibold text-blue-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-300"
          >
            Show suggestion history
          </button>
        </section>
      )}
    </div>
  );
}
