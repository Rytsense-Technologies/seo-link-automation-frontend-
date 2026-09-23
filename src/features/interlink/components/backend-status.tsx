"use client";

import { isApiError } from "@/lib/api/errors";
import { useBackendStatus } from "../hooks/use-backend-status";

const DOT = "h-2 w-2 rounded-full";

/** Connection indicator for the backend, via the server-side proxy. */
export function BackendStatus() {
  const { isPending, isSuccess, error } = useBackendStatus();

  if (isPending) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500" role="status">
        <span className={`${DOT} animate-pulse bg-slate-400`} />
        Checking backend…
      </p>
    );
  }

  if (isSuccess) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400" role="status">
        <span className={`${DOT} bg-emerald-500`} />
        Backend connected
      </p>
    );
  }

  const detail = isApiError(error) ? `${error.code} (${error.status})` : "unknown error";
  return (
    <p className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-500" role="status">
      <span className={`${DOT} bg-amber-500`} />
      Backend unavailable: {detail}
    </p>
  );
}
