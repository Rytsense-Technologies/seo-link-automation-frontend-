"use client";

import Link from "next/link";
import { useId } from "react";
import { isApiError } from "@/lib/api/errors";
import { useInterlinkSuggestion } from "../hooks/use-interlink-suggestion";
import { splitReason } from "../lib/reason";
import { isUuid } from "../lib/url-filters";
import { RelevanceScore } from "./relevance-score";
import {
  BUTTON_CLASS,
  DateValue,
  EmptyValue,
  Eyebrow,
  ExternalLink,
  Field,
  LINK_CLASS,
  Mono,
  PANEL_CLASS,
  highlightAnchor,
} from "./suggestion-fields";
import { SuggestionListError } from "./suggestion-list";
import { SuggestionReviewActions } from "./suggestion-review-actions";
import { SuggestionStatusBadge } from "./suggestion-status-badge";

function Section({ title, children, className = "" }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={`${PANEL_CLASS} ${className}`}>
      <h2 id={id} className="text-base font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** One step of the source -> anchor -> target flow. */
function FlowStep({ title, children, last = false }) {
  const id = useId();
  return (
    <li className="relative flex flex-col items-stretch">
      <section
        aria-labelledby={id}
        className="min-w-0 rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-slate-800/50 dark:ring-slate-700"
      >
        <Eyebrow as="h3" id={id}>
          {title}
        </Eyebrow>
        {children}
      </section>
      {!last && (
        <span aria-hidden="true" className="self-center py-1 text-xl leading-none text-slate-400">
          ↓
        </span>
      )}
    </li>
  );
}

function PageStep({ title, page, last }) {
  return (
    <FlowStep title={title} last={last}>
      <p className="mt-2 text-base font-semibold break-words text-slate-900 dark:text-slate-50">
        {page.title ?? <EmptyValue label="No title" />}
      </p>
      <p className="mt-1 text-sm">
        <ExternalLink href={page.url} />
      </p>
      <dl className="mt-3">
        <Field label="H1">{page.h1 ?? <EmptyValue label="No H1" />}</Field>
      </dl>
    </FlowStep>
  );
}

export function SuggestionDetailView({ suggestion }) {
  const { explanation, signals } = splitReason(suggestion.reason);
  const anchorInContext = suggestion.context.toLowerCase().includes(suggestion.anchor_text.toLowerCase());

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        <section aria-labelledby="suggested-link-heading" className={PANEL_CLASS}>
          <h2 id="suggested-link-heading" className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Suggested link
          </h2>
          <ol className="mt-4 flex flex-col">
            <PageStep title="Source page" page={suggestion.source_page} />
            <FlowStep title="Anchor text">
              <p className="mt-2 text-xl font-semibold break-words text-slate-900 sm:text-2xl dark:text-slate-50">
                <span aria-hidden="true" className="text-slate-400">
                  “
                </span>
                {suggestion.anchor_text}
                <span aria-hidden="true" className="text-slate-400">
                  ”
                </span>
              </p>
              <blockquote className="mt-3 border-l-2 border-blue-300 pl-4 text-base leading-relaxed whitespace-pre-wrap text-slate-800 dark:border-blue-700 dark:text-slate-200">
                {highlightAnchor(suggestion.context, suggestion.anchor_text)}
              </blockquote>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {anchorInContext
                  ? "Sentence from the source page. The highlighted text is where the link to the target page would be inserted."
                  : "Sentence from the source page where the link to the target page would be inserted."}
              </p>
            </FlowStep>
            <PageStep title="Target page" page={suggestion.target_page} last />
          </ol>
        </section>

        <Section title="Why this suggestion?">
          <p className="text-base leading-relaxed whitespace-pre-line text-slate-800 dark:text-slate-200">
            {explanation || <EmptyValue label="No explanation" />}
          </p>
        </Section>

        <details className={`${PANEL_CLASS} group`}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded text-base font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:text-slate-100 [&::-webkit-details-marker]:hidden">
            Technical details
            <span aria-hidden="true" className="text-slate-400 transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Retrieval score">
              {suggestion.retrieval_score === null ? (
                <EmptyValue label="Not recorded" />
              ) : (
                <span className="tabular-nums">{suggestion.retrieval_score}</span>
              )}
            </Field>
            <Field label="Provider">{suggestion.ai_provider ?? <EmptyValue label="Not recorded" />}</Field>
            <Field label="Model">{suggestion.ai_model ?? <EmptyValue label="None" />}</Field>
            <Field label="Suggestion ID">
              <Mono>{suggestion.id}</Mono>
            </Field>
            <Field label="Full reason" className="sm:col-span-2">
              <span className="leading-relaxed whitespace-pre-line">{suggestion.reason}</span>
            </Field>
          </dl>
        </details>
      </div>

      <div className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-6">
        <SuggestionReviewActions suggestion={suggestion} />

        {suggestion.rejection_reason !== null && (
          <Section title="Rejection reason" className="ring-red-200 dark:ring-red-900">
            <p className="text-sm leading-relaxed whitespace-pre-line text-slate-800 dark:text-slate-200">
              {suggestion.rejection_reason}
            </p>
          </Section>
        )}

        <Section title="Relevance">
          <RelevanceScore score={suggestion.relevance_score} size="lg" />
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Relevance score from the suggestion engine.</p>
          {signals.length > 0 && (
            <>
              <Eyebrow as="h3" className="mt-5">
                Strongest signals
              </Eyebrow>
              <ul className="mt-2 flex flex-col divide-y divide-slate-100 text-sm dark:divide-slate-800">
                {signals.map((signal) => (
                  <li key={signal.name} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="text-slate-700 dark:text-slate-300">{signal.label}</span>
                    <span className="font-medium text-slate-900 tabular-nums dark:text-slate-100">{signal.value}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>

        <Section title="Timeline">
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Created">
              <DateValue value={suggestion.created_at} />
            </Field>
            <Field label="Updated">
              <DateValue value={suggestion.updated_at} />
            </Field>
            <Field label="Reviewed">
              <DateValue value={suggestion.reviewed_at} placeholder="Not reviewed" />
            </Field>
            <Field label="Applied">
              <DateValue value={suggestion.applied_at} placeholder="Not applied" />
            </Field>
          </dl>
        </Section>
      </div>
    </div>
  );
}

export function SuggestionDetailSkeleton() {
  const block = "rounded bg-slate-200 dark:bg-slate-800";
  return (
    <div role="status" aria-label="Loading suggestion" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div aria-hidden="true" className="flex animate-pulse flex-col gap-6">
        <div className={PANEL_CLASS}>
          <div className={`h-4 w-28 ${block}`} />
          <div className="mt-4 h-24 rounded-lg bg-blue-50 dark:bg-slate-800/60" />
          <div className={`mt-5 h-3.5 w-full ${block}`} />
          <div className={`mt-2 h-3.5 w-4/5 ${block}`} />
        </div>
        <div className={PANEL_CLASS}>
          <div className={`h-4 w-40 ${block}`} />
          <div className={`mt-4 h-3.5 w-full ${block}`} />
        </div>
      </div>
      <div aria-hidden="true" className="flex animate-pulse flex-col gap-6">
        <div className={PANEL_CLASS}>
          <div className={`h-4 w-32 ${block}`} />
          <div className={`mt-4 h-10 w-full ${block}`} />
        </div>
      </div>
    </div>
  );
}

function NotFound({ backHref, backLabel }) {
  return (
    <div className={`${PANEL_CLASS} py-12 text-center`}>
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Suggestion not found</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        It may have been removed, or the link may be incorrect.
      </p>
      <Link href={backHref} className={`${BUTTON_CLASS} mt-4`}>
        {backLabel}
      </Link>
    </div>
  );
}

/**
 * Review page for one suggestion, fetched from `GET /interlink/suggestions/{id}`. `backHref` /
 * `backLabel` return to wherever the reviewer came from (an analysis or the history).
 */
export function SuggestionDetail({ suggestionId, backHref, backLabel = "Back to suggestions" }) {
  const query = useInterlinkSuggestion(suggestionId);
  const notFound = !isUuid(suggestionId) || (isApiError(query.error) && query.error.status === 404);

  let content;
  if (notFound) {
    content = <NotFound backHref={backHref} backLabel={backLabel} />;
  } else if (query.isPending) {
    content = <SuggestionDetailSkeleton />;
  } else if (query.isError) {
    content = (
      <SuggestionListError
        title="Could not load suggestion"
        error={query.error}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  } else {
    content = <SuggestionDetailView suggestion={query.data} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link href={backHref} className={`${LINK_CLASS} self-start text-sm`}>
          <span aria-hidden="true">←&nbsp;</span>
          {backLabel}
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-50">
            Internal Link Suggestion
          </h1>
          {query.data && !notFound && <SuggestionStatusBadge status={query.data.status} size="lg" />}
        </div>
      </header>
      {content}
    </div>
  );
}
