# Settings: Catalog

The Catalog holds the Metrics Readings are about and the Units they may
be reported in, each Unit belonging to a Quantity kind. Ridr ships
built-in Metrics; an Organisation adds its own. A Metric name Ridr has
never seen is registered as **unreviewed**, so its data is kept until
an admin chooses its Quantity kind. Words in capitals are from the
[glossary](../../../CONTEXT.md).

## Routes

| Path | Shows |
|---|---|
| `/settings/catalog` | Metrics (built-in first, then the Organisation's, each by name; unreviewed ones flagged), and Units grouped by Quantity kind |

## Data

| Hook | Procedure and request | Cache key |
|---|---|---|
| `useMetrics` | `CatalogService/ListMetrics {}` | method key |
| `useUnits` | `CatalogService/ListUnits {}` | method key |

- A Metric has `name`, `quantityKind` (empty while unreviewed),
  `builtIn` and `reviewed`.
- A Unit has a UCUM `code` (`km/h`, `[mi_i]/h`), a `quantityKind` and
  `aliases` (`mph`). Queries and Rules accept either spelling. The
  Quantity kinds are the distinct `quantityKind` values of
  `ListUnits`; offer them as the define form's choices.
- Both lists change rarely: give them a `staleTime` of 5 minutes. Other
  pages (Explore, Rules, Data sources) reuse these hooks.

## Mutations

| Hook | Procedure | Invalidates |
|---|---|---|
| `useDefineMetric` | `CatalogService/DefineMetric {name, quantityKind}` | method key `ListMetrics` |

Defining an unreviewed Metric reviews it. A Quantity kind Ridr doesn't
know is `InvalidArgument`; a name already defined is `AlreadyExists`.
Show the message beside the form.

## Live updates

None. Unreviewed Metrics appear as new names arrive; the list refetches
on mount and focus.

## Permissions

| Control | Needs |
|---|---|
| Route, lists | `CatalogService/ListMetrics`, `CatalogService/ListUnits` |
| Define, review | `CatalogService/DefineMetric` (whole-Organisation admins) |

Everyone else sees the Catalog read-only.

## States

| State | Shows |
|---|---|
| Loading | `Loading` |
| Unreviewed | a "Needs review" badge and, for admins, "Choose kind" |
| Error | `ErrorState`; form errors beside the form |
| Permission denied | `PermissionDenied`; no link |

There is no empty state: built-in Metrics and Units always exist.

## Done when

- Metrics list built-in first, with kind and review state; Units list
  grouped by Quantity kind with aliases.
- An admin can define a Metric and review an unreviewed one by choosing
  its Quantity kind.
- Non-admins see the Catalog without the form.
