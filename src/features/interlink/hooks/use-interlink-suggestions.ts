"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiRequest, type RequestOptions } from "@/lib/api/client";
import type { SuggestionList, SuggestionListParams } from "../types/suggestions";
import { interlinkKeys } from "./query-keys";

export const SUGGESTIONS_PATH = "interlink/suggestions";

/** Query-string values for the list endpoint; null filters are dropped by `buildProxyUrl`. */
export function suggestionListQuery(params: SuggestionListParams): NonNullable<RequestOptions["query"]> {
  return {
    status: params.status,
    site_id: params.site_id,
    source_page_id: params.source_page_id,
    min_relevance_score: params.min_relevance_score,
    page: params.page,
    page_size: params.page_size,
  };
}

export function fetchSuggestions(params: SuggestionListParams, signal?: AbortSignal): Promise<SuggestionList> {
  return apiRequest<SuggestionList>(SUGGESTIONS_PATH, {
    query: suggestionListQuery(params),
    ...(signal ? { signal } : {}),
  });
}

/**
 * One page of suggestions, paginated by the backend. While a new filter/page loads, the previous
 * result stays on screen (`isPlaceholderData`) so the list does not flash back to skeletons.
 */
export function useInterlinkSuggestions(params: SuggestionListParams) {
  return useQuery({
    queryKey: interlinkKeys.suggestionList(params),
    queryFn: ({ signal }) => fetchSuggestions(params, signal),
    placeholderData: keepPreviousData,
  });
}
