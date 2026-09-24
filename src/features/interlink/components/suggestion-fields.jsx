/** Presentational pieces shared by the suggestion list and the suggestion detail page. */

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const dayFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export function formatDate(value, { dateOnly = false } = {}) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return (dateOnly ? dayFormat : dateFormat).format(date);
}

/** A timestamp, or `placeholder` when the backend has none. */
export function DateValue({ value, placeholder = "—", dateOnly = false }) {
  const formatted = formatDate(value, { dateOnly });
  if (!formatted || !value) return <span className="text-slate-500 dark:text-slate-400">{placeholder}</span>;
  return <time dateTime={value}>{formatted}</time>;
}

/**
 * Marks the first occurrence of the anchor inside the context. The context string itself is
 * rendered unchanged; only a <mark> is wrapped around the matching slice.
 */
export function highlightAnchor(context, anchor) {
  const index = anchor ? context.toLowerCase().indexOf(anchor.toLowerCase()) : -1;
  if (index < 0) return context;
  return (
    <>
      {context.slice(0, index)}
      <mark className="rounded bg-blue-100 px-0.5 font-medium text-blue-950 dark:bg-blue-500/25 dark:text-blue-50">
        {context.slice(index, index + anchor.length)}
      </mark>
      {context.slice(index + anchor.length)}
    </>
  );
}

/** "https://site.com/a/b/?q=1" -> "/a/b/?q=1"; anything unparsable is returned as-is. */
export function urlPath(url) {
  try {
    const { pathname, search } = new URL(url);
    return `${pathname}${search}`;
  } catch {
    return url;
  }
}

/** Small uppercase label above a value ("SOURCE", "LINK TO", ...). */
export function Eyebrow({ children, as: Tag = "p", className = "", ...props }) {
  return (
    <Tag className={`text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400 ${className}`} {...props}>
      {children}
    </Tag>
  );
}

export function Field({ label, children, className = "" }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm break-words text-slate-800 dark:text-slate-200">{children}</dd>
    </div>
  );
}

export function Mono({ children }) {
  return <span className="font-mono text-xs break-all text-slate-700 dark:text-slate-300">{children}</span>;
}

/** A missing value: a dash on screen, a word for screen readers. */
export function EmptyValue({ label = "None" }) {
  return (
    <span className="text-slate-500 dark:text-slate-400">
      <span aria-hidden="true">—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export const PANEL_CLASS =
  "rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6 dark:bg-slate-900 dark:ring-slate-800";

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export const LINK_CLASS = `rounded font-medium text-blue-700 underline-offset-2 hover:underline ${FOCUS_RING} dark:text-blue-300`;

const BUTTON_BASE = `inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${FOCUS_RING} disabled:cursor-not-allowed disabled:opacity-50`;

/** Neutral secondary button (Cancel, Retry, Previous/Next, ...). */
export const BUTTON_CLASS = `${BUTTON_BASE} bg-white text-slate-800 shadow-xs ring-1 ring-slate-300 hover:bg-slate-50 disabled:hover:bg-white ring-inset dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-800 dark:disabled:hover:bg-slate-900`;

/** The one main action of a view. */
export const PRIMARY_BUTTON_CLASS = `${BUTTON_BASE} bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:hover:bg-blue-600`;

/** Secondary destructive action: outlined red. */
export const DANGER_OUTLINE_BUTTON_CLASS = `${BUTTON_BASE} bg-white text-red-700 shadow-xs ring-1 ring-red-300 ring-inset hover:bg-red-50 disabled:hover:bg-white dark:bg-slate-900 dark:text-red-300 dark:ring-red-800 dark:hover:bg-red-950/60 dark:disabled:hover:bg-slate-900`;

/** Confirming a destructive action: solid red. */
export const DANGER_BUTTON_CLASS = `${BUTTON_BASE} bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:outline-red-600 disabled:hover:bg-red-600`;

/**
 * A URL that opens in a new tab. Long URLs wrap inside their container (`overflow-wrap:anywhere`);
 * the full URL is always in the tooltip and the href, and is the visible text unless a shorter
 * `label` (such as the path) is given. The arrow is decorative; screen readers hear
 * "(opens in a new tab)" instead.
 */
export function ExternalLink({ href, label, className = "" }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={href}
      className={`${LINK_CLASS} [overflow-wrap:anywhere] ${className}`}
    >
      {label ?? href}
      <span aria-hidden="true">&nbsp;↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
