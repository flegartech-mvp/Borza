"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function BorzaQueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            gcTime: 10 * 60_000,
            retry: (failureCount, error) => {
              const status =
                typeof error === "object" && error && "problem" in error
                  ? (error as { problem?: { status?: number } }).problem?.status
                  : undefined;
              return failureCount < 2 && (!status || status >= 500);
            },
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
