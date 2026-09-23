"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { isApiError } from "@/lib/api/errors";
import { useInterlinkSuggestion } from "../hooks/use-interlink-suggestion";
import { isUuid } from "../lib/url-filters";
import type { PageSummary } from "../types/pages";
import type { SuggestionDetail as SuggestionDetailData } from "../types/suggestions";
import { BUTTON_CLASS } from "./pagination";
import { RelevanceScore } from "./relevance-score";
import { DateValue, ExternalLink, Field, LINK_CLASS, PANEL_CLASS, highlightAnchor } from "./suggestion-fields";
import { SuggestionListError } from "./suggestion-list";
import { SuggestionReviewActions } from "./suggestion-review-actions";
import { SuggestionStatusBadge } from "./suggestion-status-badge";

/** A missing value: a dash on screen, a word for screen readers. */
function EmptyValue({ label = "None" }: { label?: string }) {
  return (
    <span className="text-slate-500 dark:text-slate-400">
      <span aria-hidden="true">—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function Section({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={`${PANEL_CLASS} ${className}`}>
      <h2 id={id} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function PageSection({ title, page }: { title: string; page: PageSummary }) {
  return (
    <Section title={title}>
      <dl className="flex flex-col gap-3">
        <Field label="Title">{page.title ?? <EmptyValue label="No title" />}</Field>
        <Field label="H1">{page.h1 ?? <EmptyValue label="No H1" />}</Field>
        <Field label="URL">
          <ExternalLink href={page.url} />
        </Field>
      </dl>
    </Section>
  );
}

export function SuggestionDetailView({ suggestion }: { suggestion: SuggestionDetailData }) {
  const anchorInContext = suggestion.context.toLowerCase().includes(suggestion.anchor_text.toLowerCase());

  return (
    <div className="flex flex-col gap-4">
      <Section title="Link suggestion">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Anchor text</p>
        <p className="mt-0.5 text-lg font-semibold break-words text-slate-900 dark:text-slate-50">{suggestion.anchor_text}</p>
        <p className="mt-4 text-xs font-medium text-slate-500 dark:text-slate-400">Context</p>
        <blockquote className="mt-1 border-l-2 border-blue-300 pl-3 text-base leading-relaxed whitespace-pre-wrap text-slate-800 dark:border-blue-700 dark:text-slate-200">
          {highlightAnchor(suggestion.context, suggestion.anchor_text)}
        </blockquote>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {anchorInContext
            ? "Sentence from the source page. The highlighted text is where the link to the target page would be inserted."
            : "Sentence from the source page where the link to the target page would be inserted."}
        </p>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <PageSection title="Source page" page={suggestion.source_page} />
        <PageSection title="Target page" page={suggestion.target_page} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Relevance">
          <dl className="flex flex-col gap-3">
            <Field label="Relevance score">
              <RelevanceScore score={suggestion.relevance_score} />
            </Field>
            <Field label="Retrieval score">
              {suggestion.retrieval_score === null ? (
                <EmptyValue label="Not recorded" />
              ) : (
                <span className="tabular-nums">{suggestion.retrieval_score}</span>
              )}
            </Field>
            <Field label="Reason">
              <span className="leading-relaxed whitespace-pre-line">{suggestion.reason}</span>
            </Field>
          </dl>
        </Section>

        <Section title="Generation">
          <dl className="flex flex-col gap-3">
            <Field label="Provider">{suggestion.ai_provider ?? <EmptyValue label="Not recorded" />}</Field>
            <Field label="Model">{suggestion.ai_model ?? <EmptyValue label="None" />}</Field>
          </dl>
        </Section>
      </div>

      <SuggestionReviewActions suggestion={suggestion} />

      {suggestion.rejection_reason !== null && (
        <Section title="Rejection reason" className="border-red-200 dark:border-red-900">
          <p className="text-sm leading-relaxed whitespace-pre-line text-slate-800 dark:text-slate-200">
            {suggestion.rejection_reason}
          </p>
        </Section>
      )}

      <Section title="Metadata">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
  );
}

export function SuggestionDetailSkeleton() {
  return (
    <div role="status" aria-label="Loading suggestion" className="flex flex-col gap-4">
      {[["w-1/3", "w-full", "w-5/6"], ["w-1/4", "w-2/3", "w-3/4"], ["w-1/4", "w-1/2", "w-full"]].map((widths, index) => (
        <div key={index} aria-hidden="true" className={`${PANEL_CLASS} animate-pulse`}>
          <div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="mt-4 space-y-2">
            {widths.map((width) => (
              <div key={width} className={`h-3.5 ${width} rounded bg-slate-100 dark:bg-slate-800`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function NotFound({ backHref }: { backHref: string }) {
  return (
    <div className={`${PANEL_CLASS} px-6 py-10 text-center`}>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Suggestion not found</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        It may have been removed, or the link may be incorrect.
      </p>
      <Link href={backHref} className={`${BUTTON_CLASS} mt-4`}>
        Back to suggestions
      </Link>
    </div>
  );
}

/** Read-only detail of one suggestion, fetched from `GET /interlink/suggestions/{id}`. */
export function SuggestionDetail({ suggestionId, backHref }: { suggestionId: string; backHref: string }) {
  const query = useInterlinkSuggestion(suggestionId);
  const notFound = !isUuid(suggestionId) || (isApiError(query.error) && query.error.status === 404);

  let content: ReactNode;
  if (notFound) {
    content = <NotFound backHref={backHref} />;
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
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
        <Link href={backHref} className={`${LINK_CLASS} self-start text-sm font-medium`}>
          <span aria-hidden="true">←&nbsp;</span>Back to suggestions
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Suggestion Detail</h1>
          {query.data && !notFound && (
            <div className="flex items-center gap-3">
              <RelevanceScore score={query.data.relevance_score} />
              <SuggestionStatusBadge status={query.data.status} />
            </div>
          )}
        </div>
      </header>
      {content}
    </div>
  );
}
