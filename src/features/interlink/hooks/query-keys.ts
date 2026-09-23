import type { SuggestionListParams } from "../types/suggestions";

/**
 * Query keys for the interlink feature. Hierarchical so a later mutation (approve/reject/apply)
 * can invalidate every suggestion list with `interlinkKeys.suggestionLists()` in one call.
 * List keys embed the full parameter object, so each filter/page combination is cached separately.
 */
export const interlinkKeys = {
  all: ["interlink"] as const,
  suggestionLists: () => [...interlinkKeys.all, "suggestions", "list"] as const,
  suggestionList: (params: SuggestionListParams) => [...interlinkKeys.suggestionLists(), params] as const,
  sites: () => [...interlinkKeys.all, "sites"] as const,
  sitePages: (siteId: string, pageSize: number) =>
    [...interlinkKeys.all, "pages", { site_id: siteId, page_size: pageSize }] as const,
};
