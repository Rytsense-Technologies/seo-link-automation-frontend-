"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/client";

/**
 * Minimal real query: proves browser -> Next proxy -> Fastify works, and that TanStack Query is
 * wired up. It calls the existing `GET /api/sites` endpoint and ignores the payload - only
 * reachability is reported here. Suggestion hooks come later.
 */
export const backendStatusQueryKey = ["backend", "status"];

export function useBackendStatus() {
  return useQuery({
    queryKey: backendStatusQueryKey,
    queryFn: async () => {
      await apiRequest("sites");
      return true;
    },
  });
}
