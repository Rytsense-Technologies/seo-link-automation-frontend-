import { SuggestionDetail } from "@/features/interlink/components/suggestion-detail";
import { parseFilters, suggestionListHref } from "@/features/interlink/lib/url-filters";

export const metadata = {
  title: "Internal Link Suggestion | SEO Link Automation",
};

/**
 * Where "back" goes: the analysis or history the reviewer came from, rebuilt from the query
 * string. Only recognised values survive the round-trip.
 */
function backLinkFrom(searchParams) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) params.set(key, first);
  }
  const filters = parseFilters(params);
  return {
    href: suggestionListHref(filters),
    label: filters.url ? "Back to analysis" : "Back to suggestions",
  };
}

export default async function SuggestionDetailPage({ params, searchParams }) {
  const [{ suggestionId }, query] = await Promise.all([params, searchParams]);
  const back = backLinkFrom(query);
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <SuggestionDetail suggestionId={suggestionId} backHref={back.href} backLabel={back.label} />
    </main>
  );
}
