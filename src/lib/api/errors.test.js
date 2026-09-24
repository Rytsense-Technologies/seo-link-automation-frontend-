import { describe, expect, it } from "vitest";
import {
  ApiError,
  BACKEND_UNAVAILABLE_CODE,
  BACKEND_UNAVAILABLE_STATUS,
  isApiError,
  isBackendErrorBody,
  kindForStatus,
} from "./errors";

const envelope = (code, message = "boom", details) => ({
  error: { code, message, ...(details === undefined ? {} : { details }) },
});

describe("kindForStatus", () => {
  it.each([
    [404, "not_found"],
    [409, "conflict"],
    [422, "validation"],
    [502, "ai"],
    [503, "unavailable"],
    [BACKEND_UNAVAILABLE_STATUS, "network"],
    [418, "unknown"],
    [500, "unknown"],
  ])("maps %i to %s", (status, expected) => {
    expect(kindForStatus(status)).toBe(expected);
  });
});

describe("isBackendErrorBody", () => {
  it("accepts the backend envelope and rejects anything else", () => {
    expect(isBackendErrorBody(envelope("SUGGESTION_NOT_FOUND"))).toBe(true);
    expect(isBackendErrorBody({ error: { code: "X" } })).toBe(false);
    expect(isBackendErrorBody({ message: "nope" })).toBe(false);
    expect(isBackendErrorBody(null)).toBe(false);
    expect(isBackendErrorBody("text")).toBe(false);
  });
});

describe("ApiError.fromResponse", () => {
  it("keeps the backend code, message and details", () => {
    const error = ApiError.fromResponse(409, envelope("INVALID_STATUS_TRANSITION", "Cannot change", { current_status: "APPLIED" }));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.code).toBe("INVALID_STATUS_TRANSITION");
    expect(error.message).toBe("Cannot change");
    expect(error.kind).toBe("conflict");
    expect(error.details).toEqual({ current_status: "APPLIED" });
  });

  it("falls back when the body is not an error envelope", () => {
    const error = ApiError.fromResponse(500, "<html>gateway</html>");
    expect(error.code).toBe("UNEXPECTED_RESPONSE");
    expect(error.message).toContain("500");
    expect(error.details).toBe("<html>gateway</html>");
  });

  it("distinguishes the cases the UI branches on", () => {
    expect(ApiError.fromResponse(422, envelope("VALIDATION_ERROR")).kind).toBe("validation");
    expect(ApiError.fromResponse(502, envelope("AI_PROVIDER_ERROR")).kind).toBe("ai");
    expect(ApiError.fromResponse(503, envelope("AI_PROVIDER_NOT_CONFIGURED")).kind).toBe("unavailable");
    expect(ApiError.fromResponse(404, envelope("PAGE_NOT_FOUND")).kind).toBe("not_found");
  });
});

describe("ApiError.networkError", () => {
  it("reports an unreachable backend", () => {
    const error = ApiError.networkError("connect ECONNREFUSED");
    expect(error.kind).toBe("network");
    expect(error.code).toBe(BACKEND_UNAVAILABLE_CODE);
    expect(error.status).toBe(BACKEND_UNAVAILABLE_STATUS);
  });
});

describe("retryability", () => {
  it("retries only transient failures", () => {
    expect(ApiError.networkError("down").isRetryable).toBe(true);
    expect(ApiError.fromResponse(503, envelope("DATABASE_ERROR")).isRetryable).toBe(true);
    expect(ApiError.fromResponse(502, envelope("AI_PROVIDER_ERROR")).isRetryable).toBe(true);
    expect(ApiError.fromResponse(409, envelope("ALREADY_LINKED")).isRetryable).toBe(false);
    expect(ApiError.fromResponse(422, envelope("VALIDATION_ERROR")).isRetryable).toBe(false);
    expect(ApiError.fromResponse(404, envelope("SUGGESTION_NOT_FOUND")).isRetryable).toBe(false);
  });

  it("isApiError narrows", () => {
    expect(isApiError(ApiError.networkError("x"))).toBe(true);
    expect(isApiError(new Error("x"))).toBe(false);
  });
});
