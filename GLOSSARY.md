# Ridr web app

Terms that exist only in the web app. Every product term (Asset, Device, Adapter, Reading, Rule…) is defined once in the backend glossary at [`../Ridr/CONTEXT.md`](../Ridr/CONTEXT.md); that glossary wins on any conflict.

## Language

### Dashboards

**Widget**:
One tile on a Dashboard: a title, a Visualization and the Query that feeds it, placed on the Dashboard's grid.
_Avoid_: Panel, card, tile, chart

**Visualization**:
How a Widget draws its Query's answer. One of: *line* (Measurements over time), *stat* (one latest or aggregate value), *table*, *map* (Locations) or *events* (a list of Events).
_Avoid_: Chart type, view, display

### Maps

**Track**:
Where one Device has been: its Locations in a Query's range, oldest first, the last marked as where it is now. A map draws one Track per Device, since a Location names its Device, not its Asset.
_Avoid_: Trail, path, route (a Tag in the demo data)

### People and preferences

**Unit preference**:
The Unit a person chooses to see each Quantity kind in (for example °F for temperature). Applied to Queries the app writes for them, never to Query text they typed.
_Avoid_: Display unit, locale, setting

### Data sources

**Agent guide**:
The instructions for building an Agent with the Ridr SDK. Anyone can read it without signing in; shown right after an Adapter is registered, it carries that Adapter's ID and newly issued Ingest key.
_Avoid_: SDK docs, integration guide, quickstart
