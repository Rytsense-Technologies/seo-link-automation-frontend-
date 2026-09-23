import type { SuggestionStatus } from "../types/suggestions";

/**
 * Which review actions to offer for a status. Mirrors the backend's transition table
 * (APPROVED <- PENDING | REJECTED, REJECTED <- PENDING | APPROVED); the backend still decides,
 * and answers 409 INVALID_STATUS_TRANSITION if the status changed in the meantime.
 * Applying is not offered here.
 */
export function availableReviewActions(status: SuggestionStatus): { approve: boolean; reject: boolean } {
  return {
    approve: status === "PENDING" || status === "REJECTED",
    reject: status === "PENDING" || status === "APPROVED",
  };
}
