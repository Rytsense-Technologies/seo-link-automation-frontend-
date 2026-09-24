"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/client";
import { interlinkKeys } from "./query-keys";

/** All registered sites. The backend returns a plain (unpaginated) array. */
export function useInterlinkSites() {
  return useQuery({
    queryKey: interlinkKeys.sites(),
    queryFn: ({ signal }) => apiRequest("sites", { signal }),
    // Sites change rarely; no need to refetch whenever the filter bar remounts.
    staleTime: 5 * 60_000,
  });
}
