"use client";

import { keepPreviousData, useQueries } from "@tanstack/react-query";
import { SUGGESTION_STATUSES } from "../lib/suggestion-status";
import { interlinkKeys } from "./query-keys";
import { fetchSuggestions } from "./use-interlink-suggestions";

/** The list query for counting one status: a single-row page, whose `total` is the count. */
export function countParams(filters, status) {
  return {
    status,
    site_id: filters.site_id,
    source_page_id: filters.source_page_id,
    min_relevance_score: filters.min_relevance_score,
    page: 1,
    page_size: 1,
  };
}

/**
 * How many suggestions each status has under the current site / source page / minimum score
 * filters, read from the backend's own `total`. One small request per status (four in all),
 * cached under the suggestion-list keys, so approving or rejecting refreshes the counts too.
 * A count is `undefined` until it has loaded; it is never estimated.
 */
export function useSuggestionCounts(filters) {
  return useQueries({
    queries: SUGGESTION_STATUSES.map((status) => {
      const params = countParams(filters, status);
      return {
        queryKey: interlinkKeys.suggestionList(params),
        queryFn: ({ signal }) => fetchSuggestions(params, signal),
        select: (data) => data.total,
        placeholderData: keepPreviousData,
      };
    }),
    combine: (results) => ({
      counts: Object.fromEntries(SUGGESTION_STATUSES.map((status, index) => [status, results[index]?.data])),
      isError: results.some((result) => result.isError),
    }),
  });
}
