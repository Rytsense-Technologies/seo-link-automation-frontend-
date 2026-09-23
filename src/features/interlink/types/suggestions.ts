/**
 * Contracts for `GET /api/interlink/suggestions` (backend `SuggestionList` / `SuggestionRead`).
 * Mirrors the backend schema exactly; do not add fields the backend does not return.
 */

export const SUGGESTION_STATUSES = ["PENDING", "APPROVED", "REJECTED", "APPLIED"] as const;

export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export function isSuggestionStatus(value: unknown): value is SuggestionStatus {
  return typeof value === "string" && (SUGGESTION_STATUSES as readonly string[]).includes(value);
}

export interface Suggestion {
  id: string;
  site_id: string;
  source_page_id: string;
  target_page_id: string;
  /** URL of the target page, joined in by the list endpoint. */
  target_url: string;
  anchor_text: string;
  context: string;
  /** Integer 0-100. */
  relevance_score: number;
  reason: string;
  status: SuggestionStatus;
  created_at: string | null;
  updated_at: string | null;
  applied_at: string | null;
}

export interface SuggestionList {
  items: Suggestion[];
  total: number;
  page: number;
  page_size: number;
}

/** Query parameters accepted by the list endpoint. `null` means "no filter". */
export interface SuggestionListParams {
  status: SuggestionStatus | null;
  site_id: string | null;
  source_page_id: string | null;
  min_relevance_score: number | null;
  page: number;
  page_size: number;
}
