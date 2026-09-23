/**
 * Contracts for `GET /api/interlink/suggestions` (backend `SuggestionList` / `SuggestionRead`).
 * Mirrors the backend schema exactly; do not add fields the backend does not return.
 */

import type { PageSummary } from "./pages";

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

/** `GET /api/interlink/suggestions/{id}` (backend `SuggestionDetail`): a list item plus review and page details. */
export interface SuggestionDetail extends Suggestion {
  /** Candidate-retrieval score as returned (0-1), or null when not recorded. */
  retrieval_score: number | null;
  /** "deterministic" for suggestions generated without an AI call. */
  ai_provider: string | null;
  ai_model: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  source_page: PageSummary;
  target_page: PageSummary;
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
