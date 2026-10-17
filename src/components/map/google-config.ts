// googleMaps is how to reach Google Maps, or null when the app isn't
// configured for it, in which case maps use the keyless OpenFreeMap base
// map (ADR 0003). Both a key and a Map ID are needed: the Map ID makes
// the map a vector map, which can tilt into 3D.
export const googleMaps: { key: string; mapId: string } | null =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY && import.meta.env.VITE_GOOGLE_MAP_ID
    ? { key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY, mapId: import.meta.env.VITE_GOOGLE_MAP_ID }
    : null;
