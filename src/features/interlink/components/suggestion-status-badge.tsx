import type { SuggestionStatus } from "../types/suggestions";

/**
 * Status is always written out as text; colour and the glyph are secondary cues, so the badge
 * still reads correctly without colour.
 */
const STYLES: Record<SuggestionStatus, { label: string; glyph: string; className: string }> = {
  PENDING: {
    label: "Pending",
    glyph: "○",
    className: "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100",
  },
  APPROVED: {
    label: "Approved",
    glyph: "✓",
    className: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
  },
  REJECTED: {
    label: "Rejected",
    glyph: "✕",
    className: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
  },
  APPLIED: {
    label: "Applied",
    glyph: "●",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  },
};

export function SuggestionStatusBadge({ status }: { status: SuggestionStatus }) {
  const style = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${style.className}`}
      data-status={status}
    >
      <span aria-hidden="true">{style.glyph}</span>
      <span className="sr-only">Status: </span>
      {style.label}
    </span>
  );
}
