"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  applyFilterPatch,
  parseFilters,
  serializeFilters,
} from "../lib/url-filters";

/**
 * Reads the list filters from the URL and writes changes back to it; there is no other copy.
 *
 * Writes use `history.pushState`, which Next.js syncs with `useSearchParams` without a server
 * round-trip. Every change is a history entry, so browser back/forward steps through filters.
 * Returns `{ filters, setFilters(patch), resetFilters() }`.
 */
export function useSuggestionFilters() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  const navigate = useCallback(
    (next) => {
      const query = serializeFilters(next);
      const href = query ? `${pathname}?${query}` : pathname;
      if (href !== `${window.location.pathname}${window.location.search}`) window.history.pushState(null, "", href);
    },
    [pathname],
  );

  const setFilters = useCallback((patch) => navigate(applyFilterPatch(filters, patch)), [filters, navigate]);

  const resetFilters = useCallback(
    () =>
      navigate(applyFilterPatch(filters, { status: null, site_id: null, source_page_id: null, min_relevance_score: null })),
    [filters, navigate],
  );

  return { filters, setFilters, resetFilters };
}
