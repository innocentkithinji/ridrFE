# Errors

Every failed call arrives as a `ConnectError` with a **code**. The code
decides what the screen does; the message is for people. Handle codes
in one place so every screen behaves the same.

## One sentence per code

<!-- sample: web/starter/src/lib/errors.ts -->
```ts
export function messageFor(error: ConnectError): string {
  switch (error.code) {
    case Code.Unauthenticated:
      return "Your session has ended. Sign in again.";
    case Code.PermissionDenied:
      return "You don't have access to this.";
    case Code.NotFound:
      return "It no longer exists.";
    case Code.InvalidArgument:
    case Code.FailedPrecondition:
    case Code.AlreadyExists:
    case Code.ResourceExhausted:
      return error.rawMessage; // the server explains what to change
    case Code.Unavailable:
      return "Ridr can't be reached. Check your connection.";
    default:
      return "Something went wrong. Try again.";
  }
}
```

Use `error.rawMessage`, the server's own words, when showing them;
`error.message` adds a `[code]` prefix.

Refusals are told apart from failures, because retrying a refusal with
the same access can't help. The live hook stops at `denied` for them:

<!-- sample: web/starter/src/lib/errors.ts -->
```ts
export function isRefusal(error: unknown): boolean {
  const code = ConnectError.from(error).code;
  return code === Code.PermissionDenied || code === Code.Unauthenticated;
}
```

A refusal is one of the errors that sending the same request again
can't fix; a wrong or too costly request is another. The query cache
never retries these, and a Live query stops on them instead of
reopening:

<!-- sample: web/starter/src/lib/errors.ts -->
```ts
// Codes for a request that is wrong as sent, so it fails again unchanged.
const wrongRequest = [
  Code.InvalidArgument,
  Code.NotFound,
  Code.ResourceExhausted,
  Code.FailedPrecondition,
];

// retryWontHelp tells whether sending the same request again would fail
// the same way: a refusal, or a request the user must change first.
export function retryWontHelp(error: unknown): boolean {
  const code = ConnectError.from(error).code;
  return isRefusal(error) || wrongRequest.includes(code);
}
```

Every screen shows the same states for a failed load:

<!-- sample: web/starter/src/components/states.tsx -->
```tsx
export function ErrorState({ error }: { error: ConnectError }) {
  return (
    <section role="alert">
      <h2>Something went wrong</h2>
      <p>{messageFor(error)}</p>
    </section>
  );
}
```

and a failed action shows its message beside the control, leaving the
screen as it was (see `src/features/alerts/components/alert-actions.tsx`).

## Query problems

A query the server can't run is `InvalidArgument` with a
**`QueryProblem`** detail saying where it is wrong
(`proto/ridr/v1/query.proto`):

| Field | Meaning |
|---|---|
| `message` | what is wrong |
| `line`, `column` | where, from 1, in a text query |
| `path` | the bad field, in a JSON-form query |

Read it with `error.findDetails(QueryProblemSchema)` from `@ridr/web`,
and point at the spot in the query editor. `RunQuery`, `ExplainQuery`,
Dashboard saves and the Live query endpoint all send it.

## Contract

| Code | Means | The UI |
|---|---|---|
| `Unauthenticated` | no token, or an expired, unknown or wrong-origin one | send the user to sign-in; no retry |
| `PermissionDenied` | the Role lacks the Permission, the action needs the whole Tenant and the user has a Scope, the write would leave the Scope, or the user isn't a member of the active Organisation, or it isn't set up in Ridr ([Sessions](sessions.md#contract)) | the screen's permission-denied state for a load; the message beside the control for an action; no retry |
| `NotFound` | gone, or outside the user's Scope (the two look the same on purpose) | the screen's not-found state, "doesn't exist or isn't yours to see"; after a delete, go back to the list |
| `InvalidArgument` | the request is wrong; for queries, with a `QueryProblem` | show `rawMessage` beside the form or field; for queries, mark the spot |
| `FailedPrecondition` | valid, but not now: a Contact group still used by a Rule, removing yourself, changing your own Role | show `rawMessage`; the user changes something first |
| `AlreadyExists` | the name or key is taken | show `rawMessage` beside the name field |
| `ResourceExhausted` | the query would cost too much: range too long, too many rows, too slow, or limit too large | show `rawMessage` and ask the user to narrow the query; no automatic retry helps |
| `Unavailable` | Ridr or one of its parts can't be reached | "can't be reached"; queries retry up to 3 times |
| `Internal`, anything else | a server fault | "Something went wrong"; queries retry up to 3 times |

- **Loads** show the error in place of the data; **actions** show it
  beside the control and keep the screen's data.
- **Never retry what will fail again.** `Unauthenticated`,
  `PermissionDenied`, `InvalidArgument`, `NotFound`,
  `ResourceExhausted` and `FailedPrecondition` are not retried by the
  query cache. A Live query stops at `denied` for a refusal, and at
  `failed`, with the error, for the others.
