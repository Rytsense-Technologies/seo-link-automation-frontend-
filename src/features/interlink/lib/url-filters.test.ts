import { describe, expect, it } from "vitest";
import { PAGE_1, SITE_A, SITE_B } from "../testing/fixtures";
import {
  DEFAULT_FILTERS,
  applyFilterPatch,
  hasActiveFilters,
  parseFilters,
  serializeFilters,
  type SuggestionFilters,
} from "./url-filters";

const parse = (query: string) => parseFilters(new URLSearchParams(query));

describe("parseFilters", () => {
  it("defaults to all suggestions, page 1, 20 per page", () => {
    expect(parse("")).toEqual(DEFAULT_FILTERS);
  });

  it("reads every filter from the URL", () => {
    expect(
      parse(`status=PENDING&site_id=${SITE_A}&source_page_id=${PAGE_1}&min_relevance_score=40&page=3&page_size=50`),
    ).toEqual({
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
    const filters: SuggestionFilters = {
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
  const onPage3: SuggestionFilters = { ...DEFAULT_FILTERS, site_id: SITE_A, source_page_id: PAGE_1, page: 3 };

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
