# Query language

A Query reads Readings back. The app sends it as text (what users type
in [Explore](../features/explore.md) and Dashboard widgets) or in its
JSON form (`Query` in `proto/ridr/v1/query.proto`, what a query builder
produces); both compile to the same thing, and `ExplainQuery` turns
text into the JSON form. `RunQuery`, `ExplainQuery`, Dashboard saves
and Live queries all take it.

## Text form

A source, then stages joined by `|`:

```text
measurements
| where metric == "temperature" and asset.site in (nairobi, mombasa)
| range last 6h
| rollup avg, p95 every 15m by asset
| unit Cel
| limit 100
```

| Part | Says | Rules |
|---|---|---|
| source | what to read: `measurements`, `locations` or `events` | first, once |
| `where` | conditions every Reading meets: `field == value` or `field in (v1, v2)`, joined by `and` | may repeat; no `or` or `!=` |
| `range` | which device times: `last <duration>` or `<RFC 3339> to <RFC 3339>` | once; unset means `last 1h` |
| `rollup` | summaries over time buckets: functions, `every <width>` or `every all`, optional `by` fields | once; `measurements` only |
| `unit` | the unit to return values in, by code or alias (`mph`, `km/h`) | once; `measurements` only |
| `limit` | the most rows to return, 1 to 10,000 | once |

- **Values** are double-quoted strings with Go escapes, or bare words
  (no spaces, `|`, `,`, `=`, `"` or parentheses). Adapter values must
  be Adapter IDs.
- **Durations** are a whole number and one of `s`, `m`, `h`, `d`:
  `90s`, `5m`, `1h`, `7d`.
- **Functions:** `avg`, `min`, `max`, `sum`, `count`, `first`, `last`,
  and percentiles such as `p95` or `p99.9`.

## Fields

| Field | Filter (`where`) | Group (`by`) | Means |
|---|---|---|---|
| `device` | all sources | yes | the Device ID |
| `adapter` | all sources | no | the Adapter ID |
| `asset` | all sources | yes | the Asset's name; a Device with no Assignment stands as an Asset named by its Device ID |
| `asset.<key>` | all sources | yes | an Attribute of the Asset, such as `asset.site` |
| `tag.<key>` | all sources | yes | a Tag of the Reading, such as `tag.route` |
| `metric` | `measurements` | yes | the Metric |
| `name` | `events` | no | the Event's name |

A Reading counts for the Asset its Device was assigned to at the
Reading's device time.

## Answers

| Query | Answer |
|---|---|
| no rollup | `readings`, oldest device time first, each a `Reading` holding a Measurement, Location or Event |
| a rollup | `rows`: one per bucket and group, with `bucketStart`, the grouped fields (`deviceId`, `metric`, `asset`, `attributes`, `tags`), `values` keyed by function name, and `unit` |

**Times.** Every time is a protobuf `Timestamp` in UTC; show it in the
user's time zone. Queries place a Reading at its `deviceTime`: when the
Device says it was taken, or its `receivedTime` when Ridr judged the
Device's clock skewed (then `reportedTime` holds what the Device sent).
`bucketStart` is the start of a bucket; with `every all` there is one
bucket for the whole range.

**Units.** Measurements come back in the unit they were reported in,
unless the query asks for a `unit`: then values in a unit of the same
Quantity kind are converted, and others keep their own unit. Rows
never mix units, so a Metric reported in units that can't convert
makes separate rows; label every value with its `unit` (empty means
unitless).

## Cost limits

A query the server won't run is `ResourceExhausted`; its message says
which limit and what to change.

| Limit | Value |
|---|---|
| range, reading raw Readings | 31 days |
| range, a rollup Ridr answers from stored rollups | 2 years |
| rows in an answer | 10,000; with no `limit`, more is refused; with a `limit`, the answer is cut to the oldest rows |
| time to run | 10 s |

Stored rollups answer a rollup over a range of 6 hours or more that
filters and groups by none of `asset`, `asset.<key>` or `tag.<key>`
and asks for no percentile. Every query of a user with a Scope filters
by Attributes, so theirs always read raw Readings, up to 31 days.

## Problems

A query Ridr can't compile is `InvalidArgument` with a `QueryProblem`:
`message`, plus `line` and `column` (from 1) in text, or `path` (such
as `rollup.functions[1]`) in the JSON form. See
[Errors](../architecture/errors.md#query-problems).
