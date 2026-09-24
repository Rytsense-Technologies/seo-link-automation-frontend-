import Link from "next/link";
import { splitReason } from "../lib/reason";
import { suggestionDetailHref } from "../lib/url-filters";
import { RelevanceScore } from "./relevance-score";
import { DateValue, Eyebrow, ExternalLink, LINK_CLASS, urlPath } from "./suggestion-fields";
import { SuggestionStatusBadge } from "./suggestion-status-badge";

/**
 * The source page, as far as the list knows it. The list endpoint returns only the source page's
 * id, so its URL is shown when it is already loaded (the source-page filter's pages); otherwise
 * the id is shown, and the detail page has the full source page.
 */
function SourcePage({ pageId, page }) {
  if (page) {
    return (
      <p className="mt-1 text-sm font-medium [overflow-wrap:anywhere] text-slate-900 dark:text-slate-100" title={page.url}>
        {urlPath(page.url)}
      </p>
    );
  }
  return (
    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
      Page ID <span className="font-mono text-xs [overflow-wrap:anywhere]">{pageId}</span>
    </p>
  );
}

/**
 * One suggestion: what link goes where, why, and how relevant it is. `showSource={false}` drops
 * the source row where every card shares one source (analysis results); `headingLevel` keeps the
 * anchor heading in the right place in the page outline.
 */
export function SuggestionCard({ suggestion, href, sourcePage, showSource = true, headingLevel = 3 }) {
  const { explanation } = splitReason(suggestion.reason);
  const detailHref = href ?? suggestionDetailHref(suggestion.id, "");
  const Heading = `h${headingLevel}`;

  return (
    <article aria-labelledby={`anchor-${suggestion.id}`} className="px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <SuggestionStatusBadge status={suggestion.status} />
        <div className="flex items-center gap-2">
          <Eyebrow as="span">Relevance</Eyebrow>
          <RelevanceScore score={suggestion.relevance_score} />
        </div>
      </div>

      <Eyebrow className="mt-4">Anchor text</Eyebrow>
      <Heading
        id={`anchor-${suggestion.id}`}
        className="mt-1 text-lg font-semibold break-words text-slate-900 dark:text-slate-50"
      >
        <span aria-hidden="true" className="text-slate-400">
          “
        </span>
        {suggestion.anchor_text}
        <span aria-hidden="true" className="text-slate-400">
          ”
        </span>
      </Heading>

      <div
        className={`mt-4 grid items-center gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50 ${
          showSource ? "sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-4" : ""
        }`}
      >
        {showSource && (
          <>
            <div className="min-w-0">
              <Eyebrow>Source</Eyebrow>
              <SourcePage pageId={suggestion.source_page_id} page={sourcePage} />
            </div>
            <div aria-hidden="true" className="text-lg leading-none text-slate-400 sm:text-xl">
              <span className="sm:hidden">↓</span>
              <span className="hidden sm:inline">→</span>
            </div>
          </>
        )}
        <div className="min-w-0">
          <Eyebrow>Links to</Eyebrow>
          <p className="mt-1 text-sm">
            <ExternalLink href={suggestion.target_url} label={urlPath(suggestion.target_url)} />
          </p>
        </div>
      </div>

      {explanation && (
        <div className="mt-4">
          <Eyebrow>Why</Eyebrow>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{explanation}</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Suggested <DateValue value={suggestion.created_at} dateOnly />
          {suggestion.applied_at && (
            <>
              {" · "}Applied <DateValue value={suggestion.applied_at} dateOnly />
            </>
          )}
        </p>
        <Link href={detailHref} className={`${LINK_CLASS} inline-flex min-h-10 items-center text-sm`}>
          Review suggestion
          <span className="sr-only">: {suggestion.anchor_text}</span>
          <span aria-hidden="true"> →</span>
        </Link>
      </div>
    </article>
  );
}
