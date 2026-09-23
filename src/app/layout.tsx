import type { Metadata } from "next";
import type { ReactNode } from "react";
import { QueryProvider } from "@/lib/query/query-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "SEO Link Automation",
  description: "Review and approve internal link suggestions.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
