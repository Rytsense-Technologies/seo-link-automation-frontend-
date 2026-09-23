"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/client";
import { isUuid } from "../lib/url-filters";
import type { SuggestionDetail } from "../types/suggestions";
import { interlinkKeys } from "./query-keys";
import { SUGGESTIONS_PATH } from "./use-interlink-suggestions";

export function suggestionDetailPath(suggestionId: string): string {
  return `${SUGGESTIONS_PATH}/${encodeURIComponent(suggestionId)}`;
}

export function fetchSuggestion(suggestionId: string, signal?: AbortSignal): Promise<SuggestionDetail> {
  return apiRequest<SuggestionDetail>(suggestionDetailPath(suggestionId), signal ? { signal } : {});
}

/**
 * One suggestion with its review and page details. An id that is not a UUID is never sent: the
 * backend would only reject it, and the page treats it as "not found" instead.
 */
export function useInterlinkSuggestion(suggestionId: string) {
  return useQuery({
    queryKey: interlinkKeys.suggestionDetail(suggestionId),
    queryFn: ({ signal }) => fetchSuggestion(suggestionId, signal),
    enabled: isUuid(suggestionId),
  });
}
