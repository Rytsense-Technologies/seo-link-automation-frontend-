/**
 * Query keys for the interlink feature. Hierarchical so a later mutation (approve/reject/apply)
 * can invalidate every suggestion list with `interlinkKeys.suggestionLists()`, or lists and
 * details together with `interlinkKeys.suggestions()`, in one call.
 * List keys embed the full parameter object, so each filter/page combination is cached separately.
 */
export const interlinkKeys = {
  all: ["interlink"],
  suggestions: () => [...interlinkKeys.all, "suggestions"],
  suggestionLists: () => [...interlinkKeys.suggestions(), "list"],
  suggestionList: (params) => [...interlinkKeys.suggestionLists(), params],
  suggestionDetail: (suggestionId) => [...interlinkKeys.suggestions(), "detail", suggestionId],
  /** The indexed page (and site) a typed URL resolves to. */
  resolvedPages: () => [...interlinkKeys.all, "resolved-page"],
  resolvedPage: (url) => [...interlinkKeys.resolvedPages(), url],
  /** The last analyze response for a source page, kept for this session only (never fetched). */
  analysis: (pageId) => [...interlinkKeys.all, "analysis", pageId],
  sites: () => [...interlinkKeys.all, "sites"],
  sitePages: (siteId, pageSize) =>
    [...interlinkKeys.all, "pages", { site_id: siteId, page_size: pageSize }],
};
