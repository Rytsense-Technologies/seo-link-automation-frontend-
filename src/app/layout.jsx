import Link from "next/link";
import { QueryProvider } from "@/lib/query/query-provider";
import "./globals.css";

export const metadata = {
  title: "SEO Link Automation",
  description: "Review and approve internal link suggestions.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex h-14 w-full max-w-7xl items-center px-4 sm:px-6 lg:px-8">
            <Link
              href="/interlink"
              className="flex items-center gap-2 rounded text-sm font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:text-slate-100"
            >
              <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600 text-xs text-white">
                ⇄
              </span>
              SEO Link Automation
            </Link>
          </div>
        </header>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
