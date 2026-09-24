import { Suspense } from "react";
import { InterlinkPage as InterlinkWorkspace } from "@/features/interlink/components/interlink-page";
import { SuggestionListSkeleton } from "@/features/interlink/components/suggestion-list";

export const metadata = {
  title: "Internal Link Automation | SEO Link Automation",
};

export default function InterlinkPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-50">
          Internal Link Automation
        </h1>
        <p className="max-w-2xl text-base text-slate-600 dark:text-slate-400">
          Find relevant internal linking opportunities for any page on your website.
        </p>
      </header>
      {/* The workspace reads the URL's search params, so it renders on the client below this boundary. */}
      <Suspense fallback={<SuggestionListSkeleton />}>
        <InterlinkWorkspace />
      </Suspense>
    </main>
  );
}
