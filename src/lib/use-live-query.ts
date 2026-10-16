import { ConnectError } from "@connectrpc/connect";
import { createConnectQueryKey, useQuery, useTransport } from "@connectrpc/connect-query";
import { QueryService, type Reading, type RunQueryResponse } from "@ridr/web";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { env } from "@/config/env";
import { isRefusal, retryWontHelp } from "@/lib/errors";
import { followLiveQuery, type LiveEvent } from "@/lib/live-query";
import { meKey } from "@/lib/me";
import { useSession } from "@/lib/session";

// LiveStatus is where a Live query is, and what a screen shows for it:
//   connecting   opening the first time: the loading state
//   live         open and receiving new Readings: the data, marked live
//   reconnecting closed, reopening after a wait: the last data, marked so
//   denied       refused: the screen's permission-denied state
//   failed       a bad or too costly query: ErrorState with `error`
export type LiveStatus = "connecting" | "live" | "reconnecting" | "denied" | "failed";

export type LiveOptions = {
  // False holds the Live query closed, as when its text isn't known yet.
  enabled?: boolean;
  // The wait before reopening a closed query; doubles per failure, to 32×.
  reopenDelayMs?: number;
};

export type LiveQuery = {
  status: LiveStatus;
  // Why it stopped, when status is "denied" or "failed".
  error: ConnectError | null;
  // The answer: the opening result plus every Reading since (newest 500).
  data: RunQueryResponse | undefined;
  // The same, in the shape QueryView takes for its loading and error states.
  query: {
    isPending: boolean;
    error: ConnectError | null;
    data: RunQueryResponse | undefined;
  };
};

// textQuery is the RunQuery request for a Query written as text. A
// useQuery(QueryService.method.runQuery, textQuery(text)) reads the same
// cache entry a Live query of that text writes.
export function textQuery(text: string) {
  return { form: { case: "text" as const, value: text } };
}

// The most Readings kept per Live query; older ones drop off the front.
const maxReadings = 500;
const maxDoublings = 5;

// useLiveQuery keeps a Query's answer current. It opens a Live query for
// text while the component is mounted, writes its opening `result` over
// the RunQuery cache entry for text, and appends each new Reading.
// Unmounting, a new text or a new Session closes it; when the server
// closes it, GetMe reloads and it reopens with backoff.
export function useLiveQuery(text: string, options: LiveOptions = {}): LiveQuery {
  const enabled = options.enabled ?? true;
  const state = useKeptOpen(text, enabled, options.reopenDelayMs ?? 1000);
  // The Live query is the only writer: its first event is the answer.
  const { data } = useQuery(QueryService.method.runQuery, textQuery(text), {
    enabled: false,
    staleTime: Infinity,
  });
  const error = state.error ?? null;
  return {
    status: state.status,
    error,
    data,
    query: { isPending: !data && !error, error, data },
  };
}

type LiveState = { status: LiveStatus; error?: ConnectError };

function useKeptOpen(text: string, enabled: boolean, reopenDelayMs: number): LiveState {
  const queryClient = useQueryClient();
  const transport = useTransport();
  const { getToken } = useSession();
  const [state, setState] = useState<LiveState>({ status: "connecting" });

  useEffect(() => {
    if (!enabled) return;
    const stop = new AbortController();
    const key = createConnectQueryKey({
      schema: QueryService.method.runQuery,
      input: textQuery(text),
      transport,
      cardinality: "finite",
    });
    const open = async (onOpen: () => void) =>
      followLiveQuery({
        baseUrl: env.apiUrl,
        text,
        token: await getToken(),
        signal: stop.signal,
        onOpen,
        onEvent: (event) => writeToCache(queryClient, key, event),
      });
    void keepOpen({
      open,
      // The server closes a Live query when the user's access changes.
      reloadMe: () => queryClient.invalidateQueries({ queryKey: meKey }),
      setState,
      reopenDelayMs,
      signal: stop.signal,
    });
    return () => stop.abort();
  }, [text, enabled, reopenDelayMs, queryClient, transport, getToken]);

  return state;
}

type KeepOpen = {
  open: (onOpen: () => void) => Promise<void>;
  reloadMe: () => Promise<void>;
  setState: (state: LiveState) => void;
  reopenDelayMs: number;
  signal: AbortSignal;
};

// keepOpen opens the query and, each time it closes, reloads GetMe and
// reopens it, until stopped or until reopening can't help.
async function keepOpen(live: KeepOpen) {
  let failures = 0;
  while (!live.signal.aborted) {
    live.setState({ status: failures === 0 ? "connecting" : "reconnecting" });
    let error: unknown = null;
    try {
      await live.open(() => {
        failures = 0;
        live.setState({ status: "live" });
      });
    } catch (thrown) {
      error = thrown;
    }
    if (live.signal.aborted) return;
    if (error && retryWontHelp(error)) {
      live.setState(
        isRefusal(error)
          ? { status: "denied", error: ConnectError.from(error) }
          : { status: "failed", error: ConnectError.from(error) },
      );
      return;
    }
    failures++;
    live.setState({ status: "reconnecting" });
    await live.reloadMe();
    await sleep(live.reopenDelayMs * 2 ** Math.min(failures - 1, maxDoublings), live.signal);
  }
}

// writeToCache puts a live event where useQuery reads the Query: the
// result replaces the entry, a Reading is appended to it.
function writeToCache(queryClient: QueryClient, key: readonly unknown[], event: LiveEvent) {
  if (event.type === "result") {
    queryClient.setQueryData(key, event.result);
    return;
  }
  queryClient.setQueryData<RunQueryResponse>(key, (answer) =>
    answer ? withReading(answer, event.reading) : answer,
  );
}

function withReading(answer: RunQueryResponse, reading: Reading): RunQueryResponse {
  const readings = [...answer.readings, reading].slice(-maxReadings);
  return { ...answer, readings };
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
