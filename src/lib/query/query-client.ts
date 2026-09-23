import { QueryClient, type DefaultOptions } from "@tanstack/react-query";
import { isApiError } from "@/lib/api/errors";

/**
 * Shared QueryClient defaults.
 *
 * Retries are deliberately narrow: a 404/409/422 will never succeed on retry, and analyze calls
 * are expensive, so only genuinely transient failures (backend down, 503, AI provider error) are
 * retried, and mutations are never retried automatically.
 */
export const queryDefaults: DefaultOptions = {
  queries: {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => (isApiError(error) ? error.isRetryable && failureCount < 2 : failureCount < 2),
  },
  mutations: {
    retry: false,
  },
};

export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: queryDefaults });
}
