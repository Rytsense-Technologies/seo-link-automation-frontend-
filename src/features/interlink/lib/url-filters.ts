import { isSuggestionStatus, type SuggestionListParams } from "../types/suggestions";

/**
 * The URL is the single source of truth for the suggestion list filters:
 *
 *   /interlink?status=PENDING&site_id=<uuid>&source_page_id=<uuid>&min_relevance_score=40&page=2&page_size=50
 *
 * Parsing is defensive (a hand-edited URL falls back to defaults rather than sending the backend
 * a request it would reject), and serialising omits defaults so the canonical URL stays short.
 */

export const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;

export type SuggestionFilters = SuggestionListParams;

export const DEFAULT_FILTERS: SuggestionFilters = {
  status: null,
  site_id: null,
  source_page_id: null,
  min_relevance_score: null,
  page: 1,
  page_size: DEFAULT_PAGE_SIZE,
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseUuid(value: string | null): string | null {
  return value && UUID_PATTERN.test(value) ? value : null;
}

function parseInteger(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  return Number(value);
}

/** A whole number 0-100, or null for anything else (including empty). */
export function parseMinScore(value: string | null): number | null {
  const score = parseInteger(value);
  return score !== null && score >= 0 && score <= 100 ? score : null;
}

/** Accepts anything with a `get` method: URLSearchParams or Next's ReadonlyURLSearchParams. */
export function parseFilters(params: Pick<URLSearchParams, "get">): SuggestionFilters {
  const status = params.get("status");
  const page = parseInteger(params.get("page"));
  const pageSize = parseInteger(params.get("page_size"));
  return {
    status: isSuggestionStatus(status) ? status : null,
    site_id: parseUuid(params.get("site_id")),
    source_page_id: parseUuid(params.get("source_page_id")),
    min_relevance_score: parseMinScore(params.get("min_relevance_score")),
    page: page !== null && page >= 1 ? page : 1,
    page_size: pageSize !== null && (PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
  };
}

export function serializeFilters(filters: SuggestionFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.site_id) params.set("site_id", filters.site_id);
  if (filters.source_page_id) params.set("source_page_id", filters.source_page_id);
  if (filters.min_relevance_score !== null) params.set("min_relevance_score", String(filters.min_relevance_score));
  if (filters.page !== 1) params.set("page", String(filters.page));
  if (filters.page_size !== DEFAULT_PAGE_SIZE) params.set("page_size", String(filters.page_size));
  return params.toString();
}

export type FilterPatch = Partial<SuggestionFilters>;

/**
 * Applies a change with the list's navigation rules:
 * - changing any filter (or the page size) returns to page 1, since the old page may not exist;
 * - changing the site clears the source page, which belongs to the previous site.
 */
export function applyFilterPatch(current: SuggestionFilters, patch: FilterPatch): SuggestionFilters {
  const next: SuggestionFilters = { ...current, ...patch };
  const onlyPageChanged = Object.keys(patch).every((key) => key === "page");
  if (!onlyPageChanged) next.page = patch.page ?? 1;
  if ("site_id" in patch && patch.site_id !== current.site_id && !("source_page_id" in patch)) {
    next.source_page_id = null;
  }
  return next;
}

/** True when anything other than pagination narrows the list. */
export function hasActiveFilters(filters: SuggestionFilters): boolean {
  return (
    filters.status !== null ||
    filters.site_id !== null ||
    filters.source_page_id !== null ||
    filters.min_relevance_score !== null
  );
}
