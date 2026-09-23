import type { QueryClient } from "@tanstack/react-query";
import { interlinkKeys } from "./query-keys";

/**
 * Marks one suggestion's detail and every suggestion list stale after a review action, so the
 * UI shows the backend-confirmed status. The (mounted) detail refetches now; lists refetch when
 * the reviewer returns to them. Resolves once the active refetch has finished.
 */
export function refreshSuggestion(queryClient: QueryClient, suggestionId: string): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: interlinkKeys.suggestionDetail(suggestionId) }),
    queryClient.invalidateQueries({ queryKey: interlinkKeys.suggestionLists() }),
  ]);
}
