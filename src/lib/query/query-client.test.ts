import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { createQueryClient, queryDefaults } from "./query-client";

const retry = queryDefaults.queries?.retry;
const shouldRetry = (failureCount: number, error: Error): boolean =>
  typeof retry === "function" ? Boolean(retry(failureCount, error)) : false;

describe("query defaults", () => {
  it("creates a client with the shared defaults", () => {
    const options = createQueryClient().getDefaultOptions();
    expect(options.queries?.staleTime).toBe(30_000);
    expect(options.queries?.refetchOnWindowFocus).toBe(false);
    expect(options.mutations?.retry).toBe(false);
  });

  it("retries transient failures only, and gives up after two attempts", () => {
    expect(shouldRetry(0, ApiError.networkError("down"))).toBe(true);
    expect(shouldRetry(0, ApiError.fromResponse(503, { error: { code: "DATABASE_ERROR", message: "x" } }))).toBe(true);
    expect(shouldRetry(2, ApiError.networkError("down"))).toBe(false);
  });

  it("never retries client-side failures", () => {
    for (const status of [404, 409, 422]) {
      expect(shouldRetry(0, ApiError.fromResponse(status, { error: { code: "X", message: "y" } }))).toBe(false);
    }
  });
});
