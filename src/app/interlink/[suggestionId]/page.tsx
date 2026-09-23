import type { Metadata } from "next";
import { SuggestionDetail } from "@/features/interlink/components/suggestion-detail";
import { parseFilters, suggestionListHref } from "@/features/interlink/lib/url-filters";

export const metadata: Metadata = {
  title: "Suggestion Detail | SEO Link Automation",
};

type SearchParams = Record<string, string | string[] | undefined>;

/** Rebuilds the list URL the reviewer came from; only recognised filters survive the round-trip. */
function backHrefFrom(searchParams: SearchParams): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) params.set(key, first);
  }
  return suggestionListHref(parseFilters(params));
}

export default async function SuggestionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ suggestionId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ suggestionId }, query] = await Promise.all([params, searchParams]);
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 sm:px-6">
      <SuggestionDetail suggestionId={suggestionId} backHref={backHrefFrom(query)} />
    </main>
  );
}
