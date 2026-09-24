"use client";

import { useAnalysisResult, useResolvedPage } from "../hooks/use-analyze-page";
import { useInterlinkSuggestions } from "../hooks/use-interlink-suggestions";
import { describeAnalysisError } from "../lib/error-messages";
import { SuggestionCard } from "./suggestion-card";
import { EmptyValue, Eyebrow, ExternalLink, PANEL_CLASS } from "./suggestion-fields";
import { SuggestionListError, SuggestionListSkeleton } from "./suggestion-list";

/** How many of a page's suggestions are shown under its analysis; the history lists all of them. */
export const RESULTS_PAGE_SIZE = 50;

function resultsParams(page) {
  return {
    status: null,
    site_id: page.site_id,
    source_page_id: page.id,
    min_relevance_score: null,
    page: 1,
    page_size: RESULTS_PAGE_SIZE,
  };
}

function SourcePageCard({ page, site }) {
  return (
    <section aria-labelledby="source-page-heading" className={PANEL_CLASS}>
      <Eyebrow as="h3" id="source-page-heading">
        Source page
      </Eyebrow>
      <p className="mt-2 text-xl font-semibold break-words text-slate-900 dark:text-slate-50">
        {page.title ?? <EmptyValue label="No title" />}
      </p>
      <p className="mt-1 text-sm">
        <ExternalLink href={page.url} />
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">H1</dt>
          <dd className="mt-0.5 text-sm break-words text-slate-800 dark:text-slate-200">{page.h1 ?? <EmptyValue label="No H1" />}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">Website</dt>
          <dd className="mt-0.5 text-sm break-words text-slate-800 dark:text-slate-200">{site.name}</dd>
        </div>
      </dl>
    </section>
  );
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * What the most recent analysis of this page (in this session) did. New = the suggestions the
 * analysis stored (its response); already tracked = the page's total (the list, fetched after
 * the analysis) minus those. Both are the backend's own numbers; nothing is estimated.
 */
function AnalysisSummary({ analysis, total }) {
  const added = analysis.suggestions.length;
  const existing = total === undefined ? undefined : Math.max(0, total - added);
  return (
    <div role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100">
      <p className="font-semibold">Analysis complete</p>
      {added > 0 ? (
        <p className="mt-0.5">{plural(added, "new suggestion", "new suggestions")} found.</p>
      ) : (
        <p className="mt-0.5">No new internal-link opportunities found.</p>
      )}
      {existing > 0 && (
        <p className="mt-0.5">
          {added > 0
            ? `${plural(existing, "existing suggestion was", "existing suggestions were")} already tracked.`
            : "The existing suggestions are still available below."}
        </p>
      )}
      {analysis.generation_mode === "deterministic_fallback" && (
        <p className="mt-1 text-emerald-800 dark:text-emerald-200">
          AI scoring was not available, so these suggestions were found by matching phrases that already appear on the
          page.
        </p>
      )}
    </div>
  );
}

function SuggestionsForPage({ page, detailHref }) {
  const suggestions = useInterlinkSuggestions(resultsParams(page));
  const analysis = useAnalysisResult(page.id).data;
  const total = suggestions.data?.total;

  let content;
  if (suggestions.isPending) {
    content = <SuggestionListSkeleton count={2} />;
  } else if (suggestions.isError) {
    content = (
      <SuggestionListError error={suggestions.error} onRetry={() => void suggestions.refetch()} retrying={suggestions.isFetching} />
    );
  } else if (suggestions.data.items.length === 0) {
    content = (
      <div className={`${PANEL_CLASS} py-10 text-center`}>
        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">No internal-link opportunities found.</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">
          We couldn&apos;t find suitable pages that meet the current relevance threshold.
        </p>
      </div>
    );
  } else {
    content = (
      <>
        <ul
          aria-label={`Suggested links for ${page.title ?? page.url}`}
          className="divide-y divide-slate-200 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200 dark:divide-slate-800 dark:bg-slate-900 dark:ring-slate-800"
        >
          {suggestions.data.items.map((suggestion) => (
            <li key={suggestion.id}>
              <SuggestionCard suggestion={suggestion} href={detailHref(suggestion.id)} showSource={false} headingLevel={4} />
            </li>
          ))}
        </ul>
        {total > suggestions.data.items.length && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Showing the {suggestions.data.items.length} most recent of {total}. Filter the suggestion history below by
            this page to see them all.
          </p>
        )}
      </>
    );
  }

  return (
    <section aria-labelledby="results-heading" className="flex flex-col gap-3">
      <h3 id="results-heading" className="text-lg font-semibold text-slate-900 dark:text-slate-50">
        Suggested internal links
        {total !== undefined && (
          <span className="ml-2 text-sm font-normal text-slate-500 tabular-nums dark:text-slate-400">{total}</span>
        )}
      </h3>
      {analysis && <AnalysisSummary analysis={analysis} total={total} />}
      {content}
    </section>
  );
}

/** The analysed page (`url` from the address bar) and the internal links suggested for it. */
export function AnalysisResults({ url, detailHref, onNewAnalysis }) {
  const resolved = useResolvedPage(url);

  let content;
  if (resolved.isPending) {
    content = <SuggestionListSkeleton count={2} />;
  } else if (resolved.isError) {
    const failure = describeAnalysisError(resolved.error);
    content = (
      <div role="alert" className="rounded-xl bg-red-50 p-5 ring-1 ring-red-200 dark:bg-red-950/40 dark:ring-red-900">
        <p className="text-sm text-red-800 dark:text-red-200">{failure.message}</p>
        {failure.code && <p className="mt-1 font-mono text-xs text-red-700 dark:text-red-400">{failure.code}</p>}
      </div>
    );
  } else {
    content = (
      <>
        <SourcePageCard page={resolved.data.page} site={resolved.data.site} />
        <SuggestionsForPage page={resolved.data.page} detailHref={detailHref} />
      </>
    );
  }

  return (
    <section aria-labelledby="analysis-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="analysis-heading" className="text-xl font-semibold text-slate-900 dark:text-slate-50">
          Analysis
        </h2>
        <button
          type="button"
          onClick={onNewAnalysis}
          className="rounded text-sm font-semibold text-blue-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-300"
        >
          New analysis
        </button>
      </div>
      {content}
    </section>
  );
}
