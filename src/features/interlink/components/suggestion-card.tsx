"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { suggestionDetailHref } from "../lib/url-filters";
import type { Suggestion } from "../types/suggestions";
import { RelevanceScore } from "./relevance-score";
import { ExternalLink, Field, LINK_CLASS, Mono, formatDate, highlightAnchor } from "./suggestion-fields";
import { SuggestionStatusBadge } from "./suggestion-status-badge";

/** Contexts longer than this start collapsed to three lines, with a toggle to read them in full. */
const CONTEXT_COLLAPSE_LENGTH = 220;

/**
 * The anchor-text heading links to the detail page and its hit area is stretched over the whole
 * card (`after:inset-0`), so the card is clickable without wrapping other controls in a link.
 * The target URL and the context toggle sit above that layer (`relative z-10`) and keep working.
 */
export function SuggestionCard({ suggestion, href }: { suggestion: Suggestion; href?: string }) {
  const [expanded, setExpanded] = useState(false);
  const contextId = useId();
  const collapsible = suggestion.context.length > CONTEXT_COLLAPSE_LENGTH;
  const created = formatDate(suggestion.created_at);
  const applied = formatDate(suggestion.applied_at);

  return (
    <article
      aria-labelledby={`${contextId}-anchor`}
      className="relative rounded-lg border border-slate-200 bg-white p-4 shadow-xs transition-colors hover:border-slate-300 has-[[data-detail-link]:focus-visible]:outline-2 has-[[data-detail-link]:focus-visible]:outline-offset-2 has-[[data-detail-link]:focus-visible]:outline-blue-600 sm:p-5 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
    >
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Anchor text</p>
          <h3 id={`${contextId}-anchor`} className="mt-0.5 text-base font-semibold break-words text-slate-900 dark:text-slate-50">
            <Link
              href={href ?? suggestionDetailHref(suggestion.id, "")}
              data-detail-link=""
              className="rounded after:absolute after:inset-0 after:rounded-lg after:content-[''] hover:text-blue-700 focus-visible:outline-none dark:hover:text-blue-300"
            >
              {suggestion.anchor_text}
            </Link>
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <RelevanceScore score={suggestion.relevance_score} />
          <SuggestionStatusBadge status={suggestion.status} />
        </div>
      </header>

      <div className="mt-4">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Context</p>
        <blockquote
          id={`${contextId}-context`}
          className={`mt-1 border-l-2 border-slate-300 pl-3 text-sm leading-relaxed whitespace-pre-wrap text-slate-800 dark:border-slate-600 dark:text-slate-200 ${
            collapsible && !expanded ? "line-clamp-3" : ""
          }`}
        >
          {highlightAnchor(suggestion.context, suggestion.anchor_text)}
        </blockquote>
        {collapsible && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls={`${contextId}-context`}
            className={`${LINK_CLASS} relative z-10 mt-1 text-xs font-medium`}
          >
            {expanded ? "Show less" : "Show full context"}
          </button>
        )}
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Reason</p>
        <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-slate-700 dark:text-slate-300">
          {suggestion.reason}
        </p>
      </div>

      <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800">
        <Field label="Target URL" className="sm:col-span-2">
          <ExternalLink href={suggestion.target_url} className="relative z-10" />
        </Field>
        <Field label="Source page ID">
          <Mono>{suggestion.source_page_id}</Mono>
        </Field>
        <Field label="Created">
          {created ? <time dateTime={suggestion.created_at ?? undefined}>{created}</time> : "—"}
        </Field>
        {applied && (
          <Field label="Applied">
            <time dateTime={suggestion.applied_at ?? undefined}>{applied}</time>
          </Field>
        )}
      </dl>
    </article>
  );
}
