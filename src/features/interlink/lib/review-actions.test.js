import { describe, expect, it } from "vitest";
import { availableReviewActions } from "./review-actions";

describe("availableReviewActions", () => {
  it("offers only the backend's valid transitions", () => {
    expect(availableReviewActions("PENDING")).toEqual({ approve: true, reject: true, apply: false });
    expect(availableReviewActions("APPROVED")).toEqual({ approve: false, reject: true, apply: true });
    expect(availableReviewActions("REJECTED")).toEqual({ approve: true, reject: false, apply: false });
    expect(availableReviewActions("APPLIED")).toEqual({ approve: false, reject: false, apply: false });
  });
});
