"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/client";

/**
 * Minimal real query: proves browser -> Next proxy -> Fastify works, and that TanStack Query is
 * wired up. It calls the existing `GET /api/sites` endpoint and ignores the payload - only
 * reachability is reported here. Suggestion hooks come later.
 */
export const backendStatusQueryKey = ["backend", "status"] as const;

export function useBackendStatus(): UseQueryResult<true> {
  return useQuery({
    queryKey: backendStatusQueryKey,
    queryFn: async () => {
      await apiRequest<unknown>("sites");
      return true as const;
    },
  });
}
