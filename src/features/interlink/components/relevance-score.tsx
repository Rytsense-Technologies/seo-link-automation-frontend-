/**
 * The backend's relevance score, shown as the number plus a bar. One neutral colour for every
 * value on purpose: the score is a fact, and the UI does not grade it.
 */
export function RelevanceScore({ score }: { score: number }) {
  const clamped = Math.min(100, Math.max(0, score));
  return (
    <div className="flex items-center gap-2">
      <div
        role="meter"
        aria-label="Relevance score"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-valuetext={`${score} out of 100`}
        className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
      >
        <div className="h-full rounded-full bg-blue-600 dark:bg-blue-400" style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
        {score}
        <span className="font-normal text-slate-500 dark:text-slate-400"> / 100</span>
      </span>
    </div>
  );
}
