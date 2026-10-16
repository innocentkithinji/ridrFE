# Data flow

Server data lives in one place: the session's TanStack Query cache.
Screens read it through hooks; four things write it:

1. **Fetches.** A `useQuery` hook calls a procedure through the
   transport, which adds a fresh token, and caches the answer under
   the procedure's key.
2. **Live queries.** A Live query writes its opening result and each new
   Reading into the same key a `RunQuery` hook reads
   ([Live data](live-data.md)).
3. **Mutations.** After a change succeeds, its hook invalidates the
   keys it may have changed, and the screens showing them refetch.
4. **Session changes.** An Organisation switch or sign-out drops the
   whole cache ([Providers](providers.md)).

The diagram is in the [start page](../README.md#data-flow).

## Token to transport

Every call goes through one transport. It asks the session for a token
per call, so short-lived Clerk tokens just work and the app never
stores one:

<!-- sample: web/starter/src/lib/transport.ts -->
```ts
export function createRidrTransport(
  baseUrl: string,
  getToken: GetToken,
): Transport {
  return createConnectTransport({
    baseUrl,
    interceptors: [bearerToken(getToken)],
  });
}

// bearerToken sends the session token in the Authorization header.
function bearerToken(getToken: GetToken): Interceptor {
  return (next) => async (request) => {
    const token = await getToken();
    if (token) {
      request.header.set("Authorization", `Bearer ${token}`);
    }
    return next(request);
  };
}
```

## Queries

A query hook is one `useQuery` over a method of the generated service,
in its feature's `api/` folder. connect-query builds the cache key from
the method and the request, so two screens asking the same thing share
one entry.

The session's cache sets two defaults: answers count as fresh for 10
seconds, and an error that would come back unchanged, such as a refusal
or a bad request, is never retried ([Errors](errors.md)):

<!-- sample: web/starter/src/lib/query-client.ts -->
```ts
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
```

`select` shapes an answer without a second cache entry. The starter
uses it to find one Alert, because there is no `GetAlert` procedure:

<!-- sample: web/starter/src/features/alerts/api/get-alert.ts -->
```ts
export function useAlertAmongNewest(alertId: string) {
  return useQuery(
    AlertService.method.listAlerts,
    { limit: newestAlerts },
    {
      refetchInterval: alertsPollMs,
      select: (answer) => answer.alerts.find((a) => a.id === alertId),
    },
  );
}
```

## Mutations and invalidation

A mutation hook invalidates every key whose answer the change may
alter, by the widest key that covers them. Acknowledging an Alert
changes lists, details and delivery history, so the starter invalidates
every `AlertService` query, through one shared callback:

<!-- sample: web/starter/src/features/alerts/api/change-alert.ts -->
```ts
const alertQueries = createConnectQueryKey({
  schema: AlertService,
  cardinality: undefined,
});

// useAcknowledgeAlert records that the user has taken an Alert on.
export function useAcknowledgeAlert() {
  return useMutation(AlertService.method.acknowledgeAlert, {
    onSuccess: useReloadAlerts(),
  });
}
```

`createConnectQueryKey` with only `schema` matches a whole service;
with `schema: SomeService.method.x` and no `input`, every call of that
method. The shared callback is a hook, so each mutation hook calls it:

<!-- sample: web/starter/src/features/alerts/api/change-alert.ts -->
```ts
// useReloadAlerts returns a callback refetching every AlertService query.
function useReloadAlerts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: alertQueries });
}
```

Each feature page lists what its mutations invalidate.

## Polling for everything but Readings

Live queries carry Readings only. No Live query carries Alerts,
Deliveries or any other record, so screens that must stay current
poll:

<!-- sample: web/starter/src/features/alerts/api/polling.ts -->
```ts
// Live queries carry Readings only, so every Alerts query polls to stay
// current.
export const alertsPollMs = 15_000;
```

## Contract

- **One cache per session.** Every server answer is in the session's
  `QueryClient`; no other store copies it. Screens read through hooks.
- **Fresh token per call**, from `Session.getToken`, sent as
  `Authorization: Bearer <token>`. Never stored, logged or put in a URL.
- **Defaults:** `staleTime` 10 s; failed queries retry up to 3 times
  unless the error is `Unauthenticated`, `PermissionDenied`,
  `InvalidArgument`, `NotFound`, `ResourceExhausted` or
  `FailedPrecondition`.
- **Keys:** connect-query keys only (`createConnectQueryKey`), so
  invalidation and live writes find the entries hooks read.
- **Mutations** invalidate in `onSuccess`, by service or method key;
  they never patch the cache by hand.
- **Polling:** lists of Alerts and Deliveries refetch every 15 s
  (`alertsPollMs`). Other lists refetch on mount, focus and
  invalidation only.
- **Lists:** no procedure pages with a cursor. `ListAlerts` takes a
  `limit` (unset means 100, at most 1000); an Alert older than the
  newest 1000 can't be opened by ID.
