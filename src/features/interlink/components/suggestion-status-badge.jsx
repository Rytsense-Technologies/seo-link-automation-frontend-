import { STATUS_LABELS } from "../lib/suggestion-status";

/**
 * Status is always written out as text; colour and the glyph are secondary cues, so the badge
 * still reads correctly without colour. Pending asks for attention, approved is positive,
 * rejected is negative, applied is done.
 */
const STYLES = {
  PENDING: {
    glyph: "●",
    className: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30",
  },
  APPROVED: {
    glyph: "✓",
    className: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30",
  },
  REJECTED: {
    glyph: "✕",
    className: "bg-red-50 text-red-800 ring-red-200 dark:bg-red-500/10 dark:text-red-200 dark:ring-red-500/30",
  },
  APPLIED: {
    glyph: "✓✓",
    className: "bg-blue-50 text-blue-800 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-200 dark:ring-blue-500/30",
  },
};

export function SuggestionStatusBadge({ status, size = "sm" }) {
  const style = STYLES[status];
  const sizing = size === "lg" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ring-1 ring-inset ${sizing} ${style.className}`}
      data-status={status}
    >
      <span aria-hidden="true" className="text-[0.7em]">
        {style.glyph}
      </span>
      <span className="sr-only">Status: </span>
      {STATUS_LABELS[status]}
    </span>
  );
}
