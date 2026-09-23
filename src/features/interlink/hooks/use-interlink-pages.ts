"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/client";
import type { PageList } from "../types/pages";
import { interlinkKeys } from "./query-keys";

/** Pages fetched per "load more" step of the source-page selector. */
export const SOURCE_PAGES_PAGE_SIZE = 50;

/**
 * One site's pages for the source-page selector, loaded a batch at a time on request (the
 * endpoint has no search, and a site can have hundreds of pages). Disabled until a site is
 * chosen, so nothing is fetched at startup.
 */
export function useInterlinkPages(siteId: string | null) {
  return useInfiniteQuery({
    queryKey: interlinkKeys.sitePages(siteId ?? "", SOURCE_PAGES_PAGE_SIZE),
    queryFn: ({ pageParam, signal }) =>
      apiRequest<PageList>("pages", {
        query: { site_id: siteId, page: pageParam, page_size: SOURCE_PAGES_PAGE_SIZE },
        signal,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.page_size < last.total ? last.page + 1 : undefined),
    enabled: siteId !== null,
    staleTime: 5 * 60_000,
  });
}
