/**
 * Suggestion statuses as the backend defines them.
 *
 * A suggestion from `GET /api/interlink/suggestions` has: id, site_id, source_page_id,
 * target_page_id, target_url, anchor_text, context, relevance_score (integer 0-100), reason,
 * status, created_at, updated_at, applied_at.
 *
 * `GET /api/interlink/suggestions/{id}` adds: retrieval_score (0-1 or null), ai_provider
 * ("deterministic" when no AI was used), ai_model, rejection_reason, reviewed_at, and
 * source_page / target_page ({ id, url, title, h1 }).
 */
export const SUGGESTION_STATUSES = ["PENDING", "APPROVED", "REJECTED", "APPLIED"];

export const STATUS_LABELS = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  APPLIED: "Applied",
};

export function isSuggestionStatus(value) {
  return typeof value === "string" && SUGGESTION_STATUSES.includes(value);
}
