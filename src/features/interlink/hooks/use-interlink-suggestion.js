"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/client";
import { isUuid } from "../lib/url-filters";
import { interlinkKeys } from "./query-keys";
import { SUGGESTIONS_PATH } from "./use-interlink-suggestions";

export function suggestionDetailPath(suggestionId) {
  return `${SUGGESTIONS_PATH}/${encodeURIComponent(suggestionId)}`;
}

export function fetchSuggestion(suggestionId, signal) {
  return apiRequest(suggestionDetailPath(suggestionId), signal ? { signal } : {});
}

/**
 * One suggestion with its review and page details. An id that is not a UUID is never sent: the
 * backend would only reject it, and the page treats it as "not found" instead.
 */
export function useInterlinkSuggestion(suggestionId) {
  return useQuery({
    queryKey: interlinkKeys.suggestionDetail(suggestionId),
    queryFn: ({ signal }) => fetchSuggestion(suggestionId, signal),
    enabled: isUuid(suggestionId),
  });
}
