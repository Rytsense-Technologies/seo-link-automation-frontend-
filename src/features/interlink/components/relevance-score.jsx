/**
 * The backend's relevance score (0-100), shown as a percentage with a bar. One neutral colour
 * for every value on purpose: the score is a fact, and the UI does not grade it.
 */
export function RelevanceScore({ score, size = "sm", label = "Relevance score" }) {
  const clamped = Math.min(100, Math.max(0, score));
  const large = size === "lg";
  return (
    <div className={`flex items-center ${large ? "gap-4" : "gap-2"}`}>
      <span
        className={`font-semibold text-slate-900 tabular-nums dark:text-slate-50 ${large ? "text-4xl tracking-tight" : "text-sm"}`}
      >
        {score}%
      </span>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-valuetext={`${score}%`}
        className={`overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 ${large ? "h-2.5 flex-1" : "h-1.5 w-16"}`}
      >
        <div className="h-full rounded-full bg-blue-600 dark:bg-blue-400" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
