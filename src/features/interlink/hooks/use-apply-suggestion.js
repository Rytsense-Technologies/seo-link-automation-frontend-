"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { interlinkKeys } from "./query-keys";
import { refreshSuggestion } from "./refresh-suggestion";
import { suggestionDetailPath } from "./use-interlink-suggestion";

/**
 * `POST /interlink/suggestions/{id}/apply`: inserts the approved link into the source page's
 * content. It takes no body. This changes content, so it is only ever called after the reviewer
 * has confirmed, and it is never retried automatically.
 */
export function applySuggestion(suggestionId) {
  return apiRequest(`${suggestionDetailPath(suggestionId)}/apply`, { method: "POST" });
}

/**
 * Applies an approved suggestion. On success the suggestion, the lists and the resolved source
 * page (its content version changed) are refreshed. A 409 means the suggestion or page changed
 * underneath the reviewer (not approved any more, already linked, content edited), so the
 * suggestion is refreshed then too; nothing is retried.
 */
export function useApplySuggestion(suggestionId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => applySuggestion(suggestionId),
    onSuccess: () =>
      Promise.all([
        refreshSuggestion(queryClient, suggestionId),
        queryClient.invalidateQueries({ queryKey: interlinkKeys.resolvedPages() }),
      ]),
    onError: (error) => (isApiError(error) && error.kind === "conflict" ? refreshSuggestion(queryClient, suggestionId) : undefined),
  });
}
