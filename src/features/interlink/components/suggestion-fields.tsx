import type { ReactNode } from "react";

/** Presentational pieces shared by the suggestion card and the suggestion detail page. */

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
}

/** A timestamp, or `placeholder` when the backend has none. */
export function DateValue({ value, placeholder = "—" }: { value: string | null; placeholder?: string }) {
  const formatted = formatDate(value);
  if (!formatted || !value) return <span className="text-slate-500 dark:text-slate-400">{placeholder}</span>;
  return <time dateTime={value}>{formatted}</time>;
}

/**
 * Marks the first occurrence of the anchor inside the context. The context string itself is
 * rendered unchanged; only a <mark> is wrapped around the matching slice.
 */
export function highlightAnchor(context: string, anchor: string): ReactNode {
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

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800 dark:text-slate-200">{children}</dd>
    </div>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xs break-all text-slate-700 dark:text-slate-300">{children}</span>;
}

export const PANEL_CLASS =
  "rounded-lg border border-slate-200 bg-white p-4 shadow-xs sm:p-5 dark:border-slate-800 dark:bg-slate-900";

export const LINK_CLASS =
  "rounded text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-300";

/**
 * A URL that opens in a new tab. `break-all` wraps long URLs inside their container; the full
 * URL stays visible, in the tooltip and in the href. The arrow is decorative, and screen readers
 * hear "(opens in a new tab)" instead.
 */
export function ExternalLink({ href, className = "" }: { href: string; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={href} className={`${LINK_CLASS} break-all ${className}`}>
      {href}
      <span aria-hidden="true">&nbsp;↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
