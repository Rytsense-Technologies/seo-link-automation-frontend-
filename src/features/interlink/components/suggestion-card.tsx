"use client";

import { useId, useState, type ReactNode } from "react";
import type { Suggestion } from "../types/suggestions";
import { RelevanceScore } from "./relevance-score";
import { SuggestionStatusBadge } from "./suggestion-status-badge";

/** Contexts longer than this start collapsed to three lines, with a toggle to read them in full. */
const CONTEXT_COLLAPSE_LENGTH = 220;

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
}

/**
 * Marks the first occurrence of the anchor inside the context. The context string itself is
 * rendered unchanged; only a <mark> is wrapped around the matching slice.
 */
function highlightAnchor(context: string, anchor: string): ReactNode {
  const index = anchor ? context.toLowerCase().indexOf(anchor.toLowerCase()) : -1;
  if (index < 0) return context;
  return (
    <>
      {context.slice(0, index)}
      <mark className="rounded-sm bg-blue-100 px-0.5 text-inherit dark:bg-blue-900/60">
        {context.slice(index, index + anchor.length)}
      </mark>
      {context.slice(index + anchor.length)}
    </>
  );
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800 dark:text-slate-200">{children}</dd>
    </div>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xs break-all text-slate-700 dark:text-slate-300">{children}</span>;
}

export function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  const [expanded, setExpanded] = useState(false);
  const contextId = useId();
  const collapsible = suggestion.context.length > CONTEXT_COLLAPSE_LENGTH;
  const created = formatDate(suggestion.created_at);
  const applied = formatDate(suggestion.applied_at);

  return (
    <article
      aria-labelledby={`${contextId}-anchor`}
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs sm:p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Anchor text</p>
          <h3 id={`${contextId}-anchor`} className="mt-0.5 text-base font-semibold break-words text-slate-900 dark:text-slate-50">
            {suggestion.anchor_text}
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
            className="mt-1 rounded text-xs font-medium text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-300"
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
          {/* break-all wraps long URLs inside the card; the full URL stays visible, in the tooltip and in the href. */}
          <a
            href={suggestion.target_url}
            target="_blank"
            rel="noopener noreferrer"
            title={suggestion.target_url}
            className="rounded break-all text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-300"
          >
            {suggestion.target_url}
            <span aria-hidden="true">&nbsp;↗</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
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
