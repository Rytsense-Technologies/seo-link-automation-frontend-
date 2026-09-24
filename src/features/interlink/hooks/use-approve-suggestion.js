"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { refreshSuggestion } from "./refresh-suggestion";
import { suggestionDetailPath } from "./use-interlink-suggestion";

/** `POST /interlink/suggestions/{id}/approve`. The endpoint takes no body. */
export function approveSuggestion(suggestionId) {
  return apiRequest(`${suggestionDetailPath(suggestionId)}/approve`, { method: "POST" });
}

/**
 * Approves a suggestion. No optimistic update: on success (or a 409, meaning someone else changed
 * it first) the detail and lists are refetched, and the mutation stays pending until the detail
 * shows the backend-confirmed status.
 */
export function useApproveSuggestion(suggestionId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => approveSuggestion(suggestionId),
    onSuccess: () => refreshSuggestion(queryClient, suggestionId),
    onError: (error) => (isApiError(error) && error.kind === "conflict" ? refreshSuggestion(queryClient, suggestionId) : undefined),
  });
}
