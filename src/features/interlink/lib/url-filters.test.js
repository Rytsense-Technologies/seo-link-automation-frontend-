import { describe, expect, it } from "vitest";
import { PAGE_1, SITE_A, SITE_B } from "../testing/fixtures";
import {
  DEFAULT_FILTERS,
  applyFilterPatch,
  hasActiveFilters,
  isUuid,
  parseFilters,
  serializeFilters,
  suggestionDetailHref,
  suggestionListHref,
} from "./url-filters";

const parse = (query) => parseFilters(new URLSearchParams(query));

describe("parseFilters", () => {
  it("defaults to all suggestions, page 1, 20 per page", () => {
    expect(parse("")).toEqual(DEFAULT_FILTERS);
  });

  it("reads every filter from the URL", () => {
    expect(
      parse(`status=PENDING&site_id=${SITE_A}&source_page_id=${PAGE_1}&min_relevance_score=40&page=3&page_size=50`),
    ).toEqual({
      url: null,
      status: "PENDING",
      site_id: SITE_A,
      source_page_id: PAGE_1,
      min_relevance_score: 40,
      page: 3,
      page_size: 50,
    });
  });

  it("ignores values the backend would reject", () => {
    expect(parse("status=pending&site_id=rytsense&source_page_id=123&min_relevance_score=101&page=0&page_size=30")).toEqual(
      DEFAULT_FILTERS,
    );
    expect(parse("min_relevance_score=-1").min_relevance_score).toBeNull();
    expect(parse("min_relevance_score=4.5").min_relevance_score).toBeNull();
    expect(parse("page=abc").page).toBe(1);
  });

  it("accepts the score bounds 0 and 100", () => {
    expect(parse("min_relevance_score=0").min_relevance_score).toBe(0);
    expect(parse("min_relevance_score=100").min_relevance_score).toBe(100);
  });
});

describe("serializeFilters", () => {
  it("omits defaults, so the unfiltered URL is bare", () => {
    expect(serializeFilters(DEFAULT_FILTERS)).toBe("");
  });

  it("round-trips through parseFilters", () => {
    const filters = {
      url: null,
      status: "APPLIED",
      site_id: SITE_A,
      source_page_id: PAGE_1,
      min_relevance_score: 0,
      page: 2,
      page_size: 100,
    };
    const query = serializeFilters(filters);
    expect(query).toBe(
      `status=APPLIED&site_id=${SITE_A}&source_page_id=${PAGE_1}&min_relevance_score=0&page=2&page_size=100`,
    );
    expect(parse(query)).toEqual(filters);
  });
});

describe("applyFilterPatch", () => {
  const onPage3 = { ...DEFAULT_FILTERS, site_id: SITE_A, source_page_id: PAGE_1, page: 3 };

  it("changing a filter returns to page 1", () => {
    expect(applyFilterPatch(onPage3, { status: "REJECTED" })).toMatchObject({ status: "REJECTED", page: 1 });
    expect(applyFilterPatch(onPage3, { min_relevance_score: 40 })).toMatchObject({ min_relevance_score: 40, page: 1 });
    expect(applyFilterPatch(onPage3, { page_size: 50 })).toMatchObject({ page_size: 50, page: 1 });
  });

  it("changing only the page keeps the filters", () => {
    expect(applyFilterPatch(onPage3, { page: 4 })).toEqual({ ...onPage3, page: 4 });
  });

  it("changing the site clears the source page of the previous site", () => {
    expect(applyFilterPatch(onPage3, { site_id: SITE_B })).toMatchObject({ site_id: SITE_B, source_page_id: null });
    expect(applyFilterPatch(onPage3, { site_id: null })).toMatchObject({ site_id: null, source_page_id: null });
  });

  it("keeps the source page when the site is unchanged", () => {
    expect(applyFilterPatch(onPage3, { site_id: SITE_A }).source_page_id).toBe(PAGE_1);
  });
});

describe("hasActiveFilters", () => {
  it("ignores pagination", () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, page: 5, page_size: 100 })).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, min_relevance_score: 0 })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, status: "PENDING" })).toBe(true);
  });
});

describe("detail and list hrefs", () => {
  it("builds the detail route, keeping the list query for the way back", () => {
    expect(suggestionDetailHref(PAGE_1, "")).toBe(`/interlink/${PAGE_1}`);
    expect(suggestionDetailHref(PAGE_1, "status=PENDING&page=2")).toBe(`/interlink/${PAGE_1}?status=PENDING&page=2`);
  });

  it("builds the list route from filters", () => {
    expect(suggestionListHref(DEFAULT_FILTERS)).toBe("/interlink");
    expect(suggestionListHref({ ...DEFAULT_FILTERS, status: "REJECTED", page: 3 })).toBe("/interlink?status=REJECTED&page=3");
  });

  it("recognises UUIDs", () => {
    expect(isUuid(PAGE_1)).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});

describe("analysed page url", () => {
  const PAGE_URL = "https://example.test/services/?lang=de";

  it("reads a valid http(s) page URL and ignores anything else", () => {
    expect(parse(`url=${encodeURIComponent(PAGE_URL)}`).url).toBe(PAGE_URL);
    expect(parse("url=javascript%3Aalert(1)").url).toBeNull();
    expect(parse("url=example.test%2Fpage").url).toBeNull();
    expect(parse("url=").url).toBeNull();
  });

  it("round-trips, first in the query string", () => {
    const query = serializeFilters({ ...DEFAULT_FILTERS, url: PAGE_URL, status: "PENDING" });
    expect(query).toBe(`url=${encodeURIComponent(PAGE_URL)}&status=PENDING`);
    expect(parse(query)).toEqual({ ...DEFAULT_FILTERS, url: PAGE_URL, status: "PENDING" });
  });

  it("survives filter changes and is not itself a filter", () => {
    const withUrl = { ...DEFAULT_FILTERS, url: PAGE_URL, page: 3 };
    expect(applyFilterPatch(withUrl, { status: "APPROVED" }).url).toBe(PAGE_URL);
    expect(applyFilterPatch(withUrl, { url: "https://example.test/other/" }).page).toBe(3);
    expect(hasActiveFilters(withUrl)).toBe(false);
  });

  it("is carried to the detail page and back", () => {
    const filters = { ...DEFAULT_FILTERS, url: PAGE_URL };
    expect(suggestionDetailHref(PAGE_1, serializeFilters(filters))).toBe(`/interlink/${PAGE_1}?url=${encodeURIComponent(PAGE_URL)}`);
    expect(suggestionListHref(filters)).toBe(`/interlink?url=${encodeURIComponent(PAGE_URL)}`);
  });
});
