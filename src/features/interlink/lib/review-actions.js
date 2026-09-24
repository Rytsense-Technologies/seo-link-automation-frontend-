/**
 * Which review actions to offer for a status. Mirrors the backend's transition table
 * (APPROVED <- PENDING | REJECTED, REJECTED <- PENDING | APPROVED, APPLIED <- APPROVED); the
 * backend still decides, and answers 409 if the status changed in the meantime.
 */
export function availableReviewActions(status) {
  return {
    approve: status === "PENDING" || status === "REJECTED",
    reject: status === "PENDING" || status === "APPROVED",
    apply: status === "APPROVED",
  };
}
