import { QueryClient } from "@tanstack/react-query";
import { retryWontHelp } from "@/lib/errors";

// createQueryClient returns the cache for one session.
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Only a failure that may pass, such as Unavailable, is retried.
        retry: (failures, error) => !retryWontHelp(error) && failures < 3,
        staleTime: 10_000,
      },
    },
  });
}
