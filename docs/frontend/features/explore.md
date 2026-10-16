# Explore

Where an Operations manager investigates: write a Query, see how Ridr
understood it, and view the answer as a chart, table or map. The
language is in the [query language reference](../reference/query-language.md);
words in capitals are from the [glossary](../../../CONTEXT.md).

## Routes

| Path | Shows |
|---|---|
| `/explore` | the query editor, its understood form, and the result |
| `/explore?q=<query text>` | the same, opened on a query (links from Assets, Alerts and Dashboards) |

Keep the query text in the URL so a result can be shared and the back
button works.

## Data

| Hook | Procedure and request | Cache key |
|---|---|---|
| `useRunQuery(text)` | `QueryService/RunQuery {form: {case: "text", value: text}}` | method key + request |
| `useExplainQuery(text)` | `QueryService/ExplainQuery {form: {case: "text", value: text}}` | method key + request |
| `useLiveQuery(text)` | Live query with the same text | `QueryService/RunQuery` with that text |
| `useMetrics` (autocomplete) | `CatalogService/ListMetrics {}` | method key |
| `useUnits` (unit picker) | `CatalogService/ListUnits {}` | method key |
| `useAssets` (autocomplete) | `RegistryService/ListAssets {}` | method key |

- **Run on submit,** not on each keystroke; set `enabled` only once
  the user runs a query, and keep `staleTime` at the default.
- **How it was understood.** `ExplainQuery` returns the JSON form
  (`Query`): show the source, filters, the range, the rollup
  and the unit, so the user sees what a typo changed. Call it on submit
  beside `RunQuery`; it is cheap and needs no data.
- **Result shape.** Without a rollup the answer is `readings` in device
  time order (oldest first); with one, it is `rows`, one per bucket and
  group, each with `values` keyed by function (`avg`, `p95`...) and a
  `unit`. Draw readings of `locations` on a map, rows as a chart over
  `bucketStart`, and anything as a table. Rows never mix units: a
  metric reported in two units that can't convert gets two series.

## Mutations

None. "Save to a Dashboard" hands the text to the
[Dashboards](dashboards.md) page's mutations.

## Live updates

A "Live" toggle replaces `RunQuery` with `useLiveQuery` on the same
text. It suits queries without a rollup whose range ends now: new
Readings are appended, rollup `rows` are not recomputed
([Live data](../architecture/live-data.md)). Run the text through
`RunQuery` first: a Live query that fails to open (a bad or too
costly query) stops at `failed` with the server's message, but without
the `QueryProblem` position that `RunQuery` reports.

## Permissions

| Control | Needs |
|---|---|
| Route, run | `QueryService/RunQuery` |
| Understood form | `QueryService/ExplainQuery` |
| Live toggle | none beyond the route; every member may open a Live query |
| Autocomplete | `CatalogService/ListMetrics`, `CatalogService/ListUnits`, `RegistryService/ListAssets` |

Every role has all of them. A scoped user's results hold only Readings
of Assets in their Scope; any query of theirs reads raw Readings, so
its range is limited to 31 days.

## States

| State | Shows |
|---|---|
| Not run yet | the editor with an example query |
| Loading | the previous result dimmed, with a spinner |
| Empty | "No Readings match." with the understood form, the usual explanation |
| Query problem | `InvalidArgument` with a `QueryProblem`: underline `line`/`column` in the editor and show `message` ([Errors](../architecture/errors.md#query-problems)) |
| Too costly | `ResourceExhausted`: show `rawMessage` (it names the limit) and suggest a shorter range, a rollup or a filter |
| Error | `ErrorState` |
| Scoped user | the scope note |
| Permission denied | `PermissionDenied`; no link |

## Done when

- A query runs on submit, its understood form shows beside it, and the
  answer draws as a table, a chart (rows) or a map (Locations).
- A syntax error underlines the right spot; a too-costly query shows
  the server's reason.
- The unit picker converts values (`| unit mph`), and the URL restores
  the query.
- The Live toggle streams new Readings into the same table or map.
