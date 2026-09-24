import { describe, expect, it } from "vitest";
import { signalLabel, splitReason } from "./reason";

describe("splitReason", () => {
  it("separates the explanation from the deterministic signals, keeping values as written", () => {
    const reason =
      'The source sentence already mentions "AI chatbot development company", which matches the target page\'s title. Strongest deterministic signals: content_h1 0.74, slug_similarity 0.70, phrase_overlap 0.59.';
    expect(splitReason(reason)).toEqual({
      explanation: 'The source sentence already mentions "AI chatbot development company", which matches the target page\'s title.',
      signals: [
        { name: "content_h1", label: "Content H1", value: "0.74" },
        { name: "slug_similarity", label: "Slug similarity", value: "0.70" },
        { name: "phrase_overlap", label: "Phrase overlap", value: "0.59" },
      ],
    });
  });

  it("returns any other reason whole, with no signals", () => {
    const ai = "The target page covers pricing, which this sentence introduces.";
    expect(splitReason(ai)).toEqual({ explanation: ai, signals: [] });
  });

  it("does not split a signals list it does not recognise", () => {
    const odd = "Matches the title. Strongest signals: very strong overlap.";
    expect(splitReason(odd)).toEqual({ explanation: odd, signals: [] });
  });

  it("tolerates a missing reason", () => {
    expect(splitReason(null)).toEqual({ explanation: "", signals: [] });
  });
});

describe("signalLabel", () => {
  it("turns signal keys into readable labels", () => {
    expect(signalLabel("content_title")).toBe("Content title");
    expect(signalLabel("content_h1")).toBe("Content H1");
    expect(signalLabel("slug_similarity")).toBe("Slug similarity");
  });
});
