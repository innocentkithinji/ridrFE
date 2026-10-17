# Maps use Google Maps when configured, OpenFreeMap otherwise

Maps are drawn on a Google Maps vector map when the build has a Google Maps API key and Map ID, and on MapLibre with OpenFreeMap's keyless tiles when it doesn't. Google's vector map tilts into 3D with buildings as you zoom in, which the trains-and-buses views want; OpenFreeMap needs no account and costs nothing, so tests, CI and anyone without a key still get a working map. Both sit behind `TrackMap` in `src/components/map/`, which picks one at build time; no screen knows which draws.

Google bills each map load past a free monthly allowance, so the Google canvas reuses maps from a small pool instead of making one per mount, and the README asks for a daily quota cap so going past the allowance is refused rather than billed. Google can't change a live map's colour scheme, so switching theme makes a new map; that is the one change that does.

This supersedes the keyless-only map chosen in the spec (#1). It was chosen for needing no account; the fallback keeps that true for anyone who doesn't configure Google.

## Considered Options

- **Google Maps only**: rejected; every test run would spend map loads, and the app wouldn't work without a key.
- **Google's raster map with JSON styles**: rejected; it can't tilt into 3D.
- **Google's own markers and polylines instead of deck.gl**: rejected; one DOM element per vehicle won't animate a fleet of a thousand (#35), and deck.gl draws the same layers on the MapLibre fallback.
