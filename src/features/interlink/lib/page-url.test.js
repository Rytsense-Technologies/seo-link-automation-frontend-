import { describe, expect, it } from "vitest";
import { EMPTY_URL_MESSAGE, INVALID_URL_MESSAGE, MAX_PAGE_URL_LENGTH, validatePageUrl } from "./page-url";

describe("validatePageUrl", () => {
  it("accepts absolute http and https URLs, trimmed", () => {
    expect(validatePageUrl("  https://rytsensetech.com/ai-chatbot-development-services/  ")).toEqual({
      url: "https://rytsensetech.com/ai-chatbot-development-services/",
    });
    expect(validatePageUrl("http://example.test/a?b=1")).toEqual({ url: "http://example.test/a?b=1" });
  });

  it("asks for a URL when the field is empty or blank", () => {
    expect(validatePageUrl("")).toEqual({ error: EMPTY_URL_MESSAGE });
    expect(validatePageUrl("   ")).toEqual({ error: EMPTY_URL_MESSAGE });
    expect(validatePageUrl(undefined)).toEqual({ error: EMPTY_URL_MESSAGE });
  });
                      
  it.each([
    "rytsensetech.com/page/",
    "/ai-chatbot-development-services/",
    "ftp://example.test/file",
    "javascript:alert(1)",
    "mailto:someone@example.test",
    "https://",
    "not a url",
  ])("rejects %s", (input) => {
    expect(validatePageUrl(input)).toEqual({ error: INVALID_URL_MESSAGE });
  });

  it("rejects URLs longer than the backend accepts", () => {
    expect(validatePageUrl(`https://example.test/${"a".repeat(MAX_PAGE_URL_LENGTH)}`)).toEqual({ error: INVALID_URL_MESSAGE });
  });
});
