"use client";

import { useInterlinkSuggestions } from "../hooks/use-interlink-suggestions";
import { useSuggestionFilters } from "../hooks/use-suggestion-filters";
import { hasActiveFilters, serializeFilters, suggestionDetailHref } from "../lib/url-filters";
import { SuggestionFiltersBar } from "./suggestion-filters";
import { SuggestionList, SuggestionListError, SuggestionListSkeleton } from "./suggestion-list";

/** Read-only review list: filters live in the URL, results come one backend page at a time. */
export function InterlinkPage() {
  const { filters, setFilters, resetFilters } = useSuggestionFilters();
  const suggestions = useInterlinkSuggestions(filters);
  const filtersActive = hasActiveFilters(filters);
  const isUpdating = suggestions.isPlaceholderData && suggestions.isFetching;

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
        detailHref={(suggestionId) => suggestionDetailHref(suggestionId, serializeFilters(filters))}
        onClearFilters={resetFilters}
        onPageChange={(page) => setFilters({ page })}
        onPageSizeChange={(pageSize) => setFilters({ page_size: pageSize })}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SuggestionFiltersBar filters={filters} onChange={setFilters} onClear={resetFilters} />
      <section aria-labelledby="suggestions-heading" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="suggestions-heading" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Suggestions
            {suggestions.data && (
              <span className="ml-2 font-normal text-slate-500 tabular-nums dark:text-slate-400">
                {suggestions.data.total} total
              </span>
            )}
          </h2>
          <p role="status" className="text-xs text-slate-500 dark:text-slate-400">
            {isUpdating ? "Updating results…" : ""}
          </p>
        </div>
        {content}
      </section>
    </div>
  );
}
