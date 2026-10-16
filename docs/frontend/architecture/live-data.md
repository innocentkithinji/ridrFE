# Live data

A **Live query** is a query whose results keep streaming as new
Readings arrive. The app opens one per live view (a live map, an
Asset's latest values, a dashboard widget) and renders it from the same
cache entry a plain `RunQuery` would fill, so a screen doesn't care
whether its Readings were fetched or streamed.

Live queries are Server-Sent Events at `GET /v1/live-query`, not a
Connect procedure. The browser's `EventSource` can't send an
`Authorization` header, so the starter reads the events with `fetch`
and parses it with `eventsource-parser`.

## One hook for every live view

<!-- sample: web/starter/src/lib/use-live-query.ts -->
```ts
export function useLiveQuery(text: string, options: LiveOptions = {}) {
  const { status, error } = useKeptOpen(text, options.reopenDelayMs ?? 1000);
  // The Live query is the only writer: its first event is the answer.
  const result = useQuery(
    QueryService.method.runQuery,
    textQuery(text),
    { enabled: false, staleTime: Infinity },
  );
  return { status, error, result };
}
```

A screen uses it like any query, plus a status, and hands it to the
shared `QueryView` for its loading and error states:

<!-- sample: web/starter/src/features/alerts/components/live-readings.tsx -->
```tsx
  const { status, error, result } = useLiveQuery(text);
  if (status === "denied") {
    return <Empty>You can't see this Asset's Readings.</Empty>;
  }
  const query = {
    isPending: !result.data && !error,
    error: error ?? null,
    data: result.data,
  };
```

## Writing into the cache

The opening `result` replaces the cache entry; each new Reading is
appended, keeping the newest 500:

<!-- sample: web/starter/src/lib/use-live-query.ts -->
```ts
function writeToCache(
  queryClient: QueryClient,
  key: readonly unknown[],
  event: LiveEvent,
) {
  if (event.type === "result") {
    queryClient.setQueryData(key, event.result);
    return;
  }
  queryClient.setQueryData<RunQueryResponse>(key, (answer) =>
    answer ? withReading(answer, event.reading) : answer,
  );
}
```

Measurements, Locations and Events arrive as different event types but
the same `Reading` message, so one decoder handles all three:

<!-- sample: web/starter/src/lib/live-query.ts -->
```ts
    case "reading":
    case "location":
    case "event":
      return {
        type: "reading",
        reading: fromJsonString(ReadingSchema, message.data, options),
      };
    default:
      return null;
```

## Staying open

The server closes a Live query when the user's access changes, and on
restarts. The hook then reloads `GetMe` and reopens, waiting 1 s, then
2 s, 4 s and so on up to 32 s while reopening keeps failing. An error
that reopening can't fix stops it: a refusal (`Unauthenticated` or
`PermissionDenied`) at `denied`, a bad or too costly query at `failed`
with the server's error ([Errors](errors.md)):

<!-- sample: web/starter/src/lib/use-live-query.ts -->
```ts
async function keepOpen(live: KeepOpen) {
  let failures = 0;
  while (!live.signal.aborted) {
    live.setState({ status: failures === 0 ? "connecting" : "reconnecting" });
    const error = await openUntilClosed(live.open, () => {
      failures = 0;
      live.setState({ status: "live" });
    });
    if (live.signal.aborted) return;
    if (error && retryWontHelp(error)) {
      live.setState(stoppedBy(error));
      return;
    }
    failures++;
    live.setState({ status: "reconnecting" });
    await live.reloadMe();
    await sleep(reopenDelay(live.reopenDelayMs, failures), live.signal);
  }
}
```

Unmounting the screen closes the Live query; so does an Organisation
switch, which unmounts everything below the session.

## Contract

**Request**

| Part | Value |
|---|---|
| Method and path | `GET {api}/v1/live-query` |
| Query | `text=<query text>`, or `query=<the query's JSON form>` |
| Headers | `Authorization: Bearer <fresh token>`, `Accept: text/event-stream` |
| Permission | none: every member may open one; the server applies the user's Tenant and Scope |

**Refusal.** Before streaming, the server may answer with a Connect
error body `{"code": "...", "message": "..."}` and a matching HTTP
status: 401 `unauthenticated`, 403 `permission_denied`, 400
`invalid_argument` (a bad query, with a `QueryProblem`), 429
`resource_exhausted` (the query would cost too much).

**Events.** `Content-Type: text/event-stream`. Each event's `data` is
one line of protobuf JSON:

| Event | Data | When |
|---|---|---|
| `result` | `RunQueryResponse` | once, first: the query's answer at opening |
| `reading` | `Reading` holding a Measurement | each new matching Measurement |
| `location` | `Reading` holding a Location | each new matching Location |
| `event` | `Reading` holding an Event | each new matching Event |

- Comment lines `: ping` arrive every 15 s on a quiet Live query; ignore
  them. Ignore unknown event types too: new ones may be added.
- A Reading is sent once: none in `result` is sent again as an event,
  and none falls between the two.
- New Readings are converted to the query's requested unit, like
  `result`.
- New Readings are single Readings. They never update the rollup
  `rows` of a `result`; a screen showing rows refetches for new ones.
- A query reads one kind of Reading (its source: `measurements`,
  `locations` or `events`), so one Live query carries one event type.
- A range that ends now keeps moving: Readings keep arriving as time
  passes.
- Ridr holds up to 1000 new Readings for a slow client, then waits for
  it; keep the event handler cheap.

**Closing.** The server ends the Live query when the user's membership,
Role or Scope changes (checked every 30 s) or when it shuts down. The
client then reloads `GetMe`, reopens with a fresh token, and shows
`denied` if the reopen is refused. An open that fails for any other
reason, such as the server being down, is retried with the backoff.

**Statuses** the hook reports, and what the screen shows:

| Status | Meaning | Show |
|---|---|---|
| `connecting` | opening for the first time | loading state (no data yet) |
| `live` | open, receiving new Readings | the data, marked live |
| `reconnecting` | closed, reopening after a wait | the last data, marked as reconnecting |
| `denied` | refused | the screen's permission-denied state |
| `failed` | the query is wrong or costs too much; `error` holds why | `ErrorState` with the error |

**Gaps**

- A failed open carries the server's message, but the starter doesn't
  read its `QueryProblem`. Check a user-written query with `RunQuery`
  first, which answers with the position ([Errors](errors.md)).
- No Live query carries Alerts or any record other than Readings;
  Alert lists poll every 15 s
  ([Data flow](data-flow.md#polling-for-everything-but-readings)).
- One Ridr process sustains about 500 Readings per second end to end;
  Rule evaluation is the limit. A live view of a busy fleet should
  narrow its query (by Asset, metric or attribute) rather than stream
  everything.

**Tests:** `src/lib/use-live-query.test.tsx` covers writing into the
cache, reloading `GetMe` and reopening, `denied` on refusal, `failed`
with the server's message for a bad or costly query, reopening when the
server can't be reached, the token in a header and never the URL, and
closing on unmount.
