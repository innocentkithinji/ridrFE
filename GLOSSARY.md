# Ridr web app

Terms that exist only in the web app. Every product term (Asset, Device, Adapter, Reading, Rule…) is defined once in the backend glossary at [`../Ridr/CONTEXT.md`](../Ridr/CONTEXT.md); that glossary wins on any conflict.

## Language

### Dashboards

**Widget**:
A part of a Dashboard: a title, a Visualization and the Query that feeds it, at one place on the Dashboard's grid.
_Avoid_: Panel, card, tile, chart

**Visualization**:
How a Widget draws its Query's answer. One of: *line* (Measurements over time), *stat* (one latest or aggregate value), *table*, *map* (Locations) or *events* (a list of Events).
_Avoid_: Chart type, view, display

**Query builder**:
Where a Query is put together by picking options (source, Metric, conditions, range, summarising, Unit) instead of writing text. It always shows the Query text it writes, and "Edit as text" switches to the Query editor.
_Avoid_: Query wizard, visual editor, form mode

**Template**:
A starting point for a new Widget ("Live map of a fleet", "One Metric over time", "Latest value", "Recent events"): a title, a Visualization and a Query that open in the Query builder, ready to change.
_Avoid_: Preset, example, blueprint

### Maps

**Track**:
Where one Device has been: its Locations in a Query's range, oldest first, the last marked as where it is now. A map draws one Track per Device, since a Location names its Device, not its Asset.
_Avoid_: Trail, path, route (a Tag in the demo data)

**Vehicle**:
How a live map draws a Track: an icon moving smoothly between its reported Locations, shown a few seconds behind them so there is always a next one to move to, turned to its heading. Selecting one shows its card (Mode, Motion, last report, position) and the trail it has left.
_Avoid_: Marker, pin, sprite

**Mode**:
What kind of vehicle a Track is (rail, tram, subway, bus or ferry), from its newest Location's `mode` Tag. It picks the Vehicle's icon and colour, and how fast it could plausibly go; without the Tag, a Vehicle is an arrow.
_Avoid_: Type, kind, category

**Motion**:
What a Vehicle's card says it is doing: EN ROUTE (its Locations either side of now differ), STOPPED (two in a row at one place), NO FIX (nothing for 90 seconds) or WAITING (too little to tell yet).
_Avoid_: Status, state

### People and preferences

**Unit preference**:
The Unit a person chooses to see each Quantity kind in (for example °F for temperature). Applied to Queries the app writes for them, never to Query text they typed.
_Avoid_: Display unit, locale, setting

### Data sources

**Agent guide**:
The instructions for building an Agent with the Ridr SDK. Anyone can read it without signing in; shown right after an Adapter is registered, it carries that Adapter's ID and newly issued Ingest key.
_Avoid_: SDK docs, integration guide, quickstart
