"use client";

import { useId, useRef, useState } from "react";
import { isApiError } from "@/lib/api/errors";
import { useAnalyzePage } from "../hooks/use-analyze-page";
import { describeAnalysisError } from "../lib/error-messages";
import { validatePageUrl } from "../lib/page-url";
import { PRIMARY_BUTTON_CLASS } from "./suggestion-fields";

/** What the requests behind the buttons are doing; these are the only stages ever claimed. */
const STAGE_MESSAGES = {
  checking: "Checking the page…",
  crawling: "Crawling the page on your website…",
  analyzing: "Analyzing the page…",
};

/** The URL lookup said "not in the index": the page may well exist, it just hasn't been crawled. */
const isNotIndexed = (error, stage) => isApiError(error) && error.code === "PAGE_NOT_FOUND" && stage === "checking";

function NotIndexedNotice({ onCrawl, busy, crawling }) {
  return (
    <div role="status" className="mt-4 rounded-lg bg-amber-50 p-4 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/30">
      <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100">Page not indexed yet</h3>
      <p className="mt-1 text-sm text-amber-900 dark:text-amber-100">
        We haven&apos;t indexed this page yet, so we can&apos;t generate internal-link suggestions for it. Run a crawl to
        add this page to the internal-link index.
      </p>
      <button type="button" className={`${PRIMARY_BUTTON_CLASS} mt-3`} onClick={onCrawl} disabled={busy}>
        {crawling ? "Crawling & analyzing…" : "Crawl & Analyze"}
      </button>
    </div>
  );
}

/**
 * The start of the workflow: one page URL in, suggestions out. `currentUrl` is the page already
 * shown (from the address bar), whose button reads "Analyze again"; `onAnalyzed(pageUrl)` gets
 * the indexed page's URL once the analysis has finished. A page that is not indexed yet can be
 * crawled and analyzed in one step.
 */
export function AnalyzePanel({ currentUrl, onAnalyzed }) {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const [draft, setDraft] = useState(currentUrl ?? "");
  const [lastUrl, setLastUrl] = useState(currentUrl);
  const [validationError, setValidationError] = useState(null);
  const [stage, setStage] = useState(null);
  const [crawlRun, setCrawlRun] = useState(false);
  // The stage a request was in when it failed ("checking" / "crawling" / "analyzing").
  const stageRef = useRef(null);
  const [failedStage, setFailedStage] = useState(null);
  const analyze = useAnalyzePage({
    onStage: (next) => {
      stageRef.current = next;
      setStage(next);
    },
  });

  // The address bar moved to another page (back/forward, "new analysis"): show that URL.
  if (currentUrl !== lastUrl) {
    setLastUrl(currentUrl);
    setDraft(currentUrl ?? "");
    setValidationError(null);
  }

  const notIndexed = analyze.isError && isNotIndexed(analyze.error, failedStage);
  const failure = analyze.isError && !notIndexed ? describeAnalysisError(analyze.error) : null;
  const errorMessage = validationError ?? failure?.message ?? null;
  const sameAsShown = Boolean(currentUrl) && draft.trim() === currentUrl;

  const run = (url, crawl) => {
    setCrawlRun(crawl);
    setFailedStage(null);
    analyze.mutate(
      { url, crawl },
      {
        onSuccess: ({ resolved }) => onAnalyzed(resolved.page.url),
        onError: () => setFailedStage(stageRef.current),
        onSettled: () => setStage(null),
      },
    );
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (analyze.isPending) return;
    const { url, error } = validatePageUrl(draft);
    if (error) {
      setValidationError(error);
      analyze.reset();
      return;
    }
    setValidationError(null);
    setDraft(url);
    run(url, false);
  };

  const handleCrawl = () => {
    if (analyze.isPending) return;
    const { url } = validatePageUrl(draft);
    if (url) run(url, true);
  };

  let buttonLabel = sameAsShown ? "Analyze again" : "Analyze page";
  if (analyze.isPending && !crawlRun) buttonLabel = "Analyzing page…";

  return (
    <section
      aria-labelledby="analyze-heading"
      className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8 dark:bg-slate-900 dark:ring-slate-800"
    >
      <h2 id="analyze-heading" className="text-lg font-semibold text-slate-900 dark:text-slate-50">
        Analyze a page
      </h2>
      <form noValidate onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
          <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Page URL
          </label>
          <input
            id={inputId}
            type="url"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            placeholder="https://www.example.com/your-page/"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (validationError) setValidationError(null);
              if (analyze.isError) analyze.reset();
            }}
            readOnly={analyze.isPending}
            aria-invalid={Boolean(errorMessage)}
            aria-describedby={errorMessage ? `${errorId} ${hintId}` : hintId}
            className="mt-1.5 block min-h-12 w-full rounded-lg border-0 bg-white px-4 text-base text-slate-900 shadow-xs ring-1 ring-slate-300 ring-inset placeholder:text-slate-400 read-only:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-500 dark:bg-slate-950 dark:text-slate-100 dark:ring-slate-700 dark:read-only:bg-slate-900"
          />
          <p id={hintId} className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            {sameAsShown
              ? "Re-analyze this page to find new internal-link opportunities."
              : "Enter any page on your website."}
          </p>
        </div>
        <button
          type="submit"
          className={`${PRIMARY_BUTTON_CLASS} min-h-12 px-6 text-base md:mt-7`}
          disabled={analyze.isPending}
        >
          {buttonLabel}
        </button>
      </form>

      <p role="status" className="mt-3 text-sm text-slate-600 empty:hidden dark:text-slate-300">
        {analyze.isPending && stage ? STAGE_MESSAGES[stage] : ""}
      </p>
      {(notIndexed || (analyze.isPending && crawlRun)) && (
        <NotIndexedNotice onCrawl={handleCrawl} busy={analyze.isPending} crawling={analyze.isPending && crawlRun} />
      )}
      {errorMessage && (
        <div
          id={errorId}
          role="alert"
          className="mt-3 rounded-lg bg-red-50 p-3 text-sm ring-1 ring-red-200 dark:bg-red-950/40 dark:ring-red-900"
        >
          <p className="text-red-800 dark:text-red-200">{errorMessage}</p>
          {!validationError && failure?.code && (
            <p className="mt-1 font-mono text-xs text-red-700 dark:text-red-400">{failure.code}</p>
          )}
        </div>
      )}
    </section>
  );
}
