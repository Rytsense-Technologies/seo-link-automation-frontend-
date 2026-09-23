import type { SuggestionListParams } from "../types/suggestions";

/**
 * Query keys for the interlink feature. Hierarchical so a later mutation (approve/reject/apply)
 * can invalidate every suggestion list with `interlinkKeys.suggestionLists()`, or lists and
 * details together with `interlinkKeys.suggestions()`, in one call.
 * List keys embed the full parameter object, so each filter/page combination is cached separately.
 */
export const interlinkKeys = {
  all: ["interlink"] as const,
  suggestions: () => [...interlinkKeys.all, "suggestions"] as const,
  suggestionLists: () => [...interlinkKeys.suggestions(), "list"] as const,
  suggestionList: (params: SuggestionListParams) => [...interlinkKeys.suggestionLists(), params] as const,
  suggestionDetail: (suggestionId: string) => [...interlinkKeys.suggestions(), "detail", suggestionId] as const,
  sites: () => [...interlinkKeys.all, "sites"] as const,
  sitePages: (siteId: string, pageSize: number) =>
    [...interlinkKeys.all, "pages", { site_id: siteId, page_size: pageSize }] as const,
};
