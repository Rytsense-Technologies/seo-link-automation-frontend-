"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "./query-client";

/**
 * App Router setup: the client is created inside `useState` so each browser session gets one
 * stable instance, and a server render never shares cache between requests.
 */
export function QueryProvider({ children, client }) {
  const [queryClient] = useState(() => client ?? createQueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
