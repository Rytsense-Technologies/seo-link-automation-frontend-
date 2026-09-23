/**
 * The backend's error envelope and the error type the UI works with.
 *
 * Every backend endpoint answers failures with:
 *   { "error": { "code": "SUGGESTION_NOT_FOUND", "message": "...", "details": {...} } }
 */

export interface BackendErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Status the proxy reports when the backend cannot be reached at all (it never returns 504 itself). */
export const BACKEND_UNAVAILABLE_STATUS = 504;
export const BACKEND_UNAVAILABLE_CODE = "BACKEND_UNAVAILABLE";

export type ApiErrorKind =
  | "validation" // 422 - request rejected by the backend's schema
  | "not_found" // 404
  | "conflict" // 409 - invalid status transition, already linked, version conflict
  | "ai" // 502 - AI provider failed or returned invalid output
  | "unavailable" // 503 - database or AI provider not configured
  | "network" // backend unreachable / request aborted
  | "unknown";

export function kindForStatus(status: number): ApiErrorKind {
  switch (status) {
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 422:
      return "validation";
    case 502:
      return "ai";
    case 503:
      return "unavailable";
    case BACKEND_UNAVAILABLE_STATUS:
      return "network";
    default:
      return "unknown";
  }
}

/** Narrowing helper for `unknown` JSON. */
export function isBackendErrorBody(value: unknown): value is BackendErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const { error } = value as { error: unknown };
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { code?: unknown }).code === "string" &&
    typeof (error as { message?: unknown }).message === "string"
  );
}

/**
 * A failed API call. Carries the backend's own code so callers can branch on
 * `INVALID_STATUS_TRANSITION`, `ALREADY_LINKED`, ... rather than on message text.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly kind: ApiErrorKind;
  readonly details?: unknown;

  constructor(options: { status: number; code: string; message: string; details?: unknown }) {
    super(options.message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.kind = kindForStatus(options.status);
    this.details = options.details;
  }

  static fromResponse(status: number, body: unknown): ApiError {
    if (isBackendErrorBody(body)) {
      return new ApiError({
        status,
        code: body.error.code,
        message: body.error.message,
        details: body.error.details,
      });
    }
    return new ApiError({
      status,
      code: "UNEXPECTED_RESPONSE",
      message: `Request failed with status ${status}`,
      details: body,
    });
  }

  static networkError(message: string): ApiError {
    return new ApiError({
      status: BACKEND_UNAVAILABLE_STATUS,
      code: BACKEND_UNAVAILABLE_CODE,
      message,
    });
  }

  /** Retrying the identical request could plausibly succeed. */
  get isRetryable(): boolean {
    return this.kind === "network" || this.kind === "unavailable" || this.kind === "ai";
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
