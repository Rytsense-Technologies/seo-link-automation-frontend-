"use client";

import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/client";
import { interlinkKeys } from "./query-keys";

/** `GET /api/pages/resolve?url=`: the indexed page and site for a URL. Nothing is fetched from the website. */
export function resolvePage(url, signal) {
  return apiRequest("pages/resolve", { query: { url }, ...(signal ? { signal } : {}) });
}

/**
 * `POST /api/pages/discover`: crawls this one URL into the page inventory (the backend's regular
 * crawler, limited to that page: robots.txt, SSRF protection and redirect checks all apply) and
 * returns `{ site, page }` like `resolvePage`. It reads the website; it never changes it.
 */
export function discoverPage(url) {
  return apiRequest("pages/discover", { method: "POST", body: { url } });
}

/**
 * The body sent to `POST /api/interlink/analyze`. AI scoring is requested with the backend's own
 * deterministic fallback, so an unavailable AI provider still yields explainable suggestions
 * instead of an error. Limits and the relevance threshold stay at the backend's configuration.
 */
export function analyzeRequestBody(sourcePageId) {
  return { source_page_id: sourcePageId, use_ai: true, ai_fallback: true };
}

/** `POST /api/interlink/analyze`: stores new PENDING suggestions for the page and returns them. */
export function analyzePage(sourcePageId) {
  return apiRequest("interlink/analyze", { method: "POST", body: analyzeRequestBody(sourcePageId) });
}

/** The page a URL (from the address bar) resolves to. */
export function useResolvedPage(url) {
  return useQuery({
    queryKey: interlinkKeys.resolvedPage(url ?? ""),
    queryFn: ({ signal }) => resolvePage(url, signal),
    enabled: Boolean(url),
  });
}

/**
 * The analyze response for a page from earlier in this session, if any. Read from the cache
 * only: an analysis is never re-run just to show its summary again.
 */
export function useAnalysisResult(pageId) {
  return useQuery({ queryKey: interlinkKeys.analysis(pageId ?? ""), queryFn: skipToken });
}

/**
 * URL -> page -> analysis, called as `mutate({ url, crawl })`. With `crawl: false` the page must
 * already be indexed (it is looked up); with `crawl: true` it is crawled into the index first.
 * `onStage("checking" | "crawling" | "analyzing")` reports which request is running; the failed
 * stage is reported the same way, so callers can tell "not indexed" from other errors.
 *
 * Analyzing a page again never removes or resets anything: the backend only adds suggestions for
 * pairs that have none yet. On success the page and the analyze response are cached, and every
 * suggestion list is refreshed.
 */
export function useAnalyzePage({ onStage } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ url, crawl = false }) => {
      onStage?.(crawl ? "crawling" : "checking");
      const resolved = crawl ? await discoverPage(url) : await resolvePage(url);
      onStage?.("analyzing");
      const analysis = await analyzePage(resolved.page.id);
      return { resolved, analysis };
    },
    onSuccess: ({ resolved, analysis }) => {
      queryClient.setQueryData(interlinkKeys.resolvedPage(resolved.page.url), resolved);
      queryClient.setQueryData(interlinkKeys.analysis(resolved.page.id), analysis);
      return queryClient.invalidateQueries({ queryKey: interlinkKeys.suggestionLists() });
    },
  });
}
