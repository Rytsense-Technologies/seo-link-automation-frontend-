"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { refreshSuggestion } from "./refresh-suggestion";
import { suggestionDetailPath } from "./use-interlink-suggestion";

/** Backend `RejectRequest.reason` maxLength. */
export const REJECTION_REASON_MAX_LENGTH = 2000;

/** Length as the backend's JSON-schema `maxLength` counts it: Unicode code points, not UTF-16 units. */
export function reasonLength(reason) {
  return [...reason.trim()].length;
}

/** The request body: `{ reason }` with the trimmed reason, or `{}` when it is empty. */
export function rejectBody(reason) {
  const trimmed = reason?.trim() ?? "";
  return trimmed ? { reason: trimmed } : {};
}

/** `POST /interlink/suggestions/{id}/reject` with an optional reason. */
export function rejectSuggestion(suggestionId, reason) {
  return apiRequest(`${suggestionDetailPath(suggestionId)}/reject`, {
    method: "POST",
    body: rejectBody(reason),
  });
}

/** Rejects a suggestion; refresh and conflict handling match `useApproveSuggestion`. */
export function useRejectSuggestion(suggestionId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason) => rejectSuggestion(suggestionId, reason),
    onSuccess: () => refreshSuggestion(queryClient, suggestionId),
    onError: (error) => (isApiError(error) && error.kind === "conflict" ? refreshSuggestion(queryClient, suggestionId) : undefined),
  });
}
