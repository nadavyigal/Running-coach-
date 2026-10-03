const MAPLIBRE_WORKER_URL = '/maplibre/maplibre-gl-worker.mjs';

let maplibreModule: typeof import('maplibre-gl') | null = null;

export async function loadMapLibre() {
  if (maplibreModule) {
    return maplibreModule;
  }

  const maplibre = await import('maplibre-gl');
  maplibre.setWorkerUrl(MAPLIBRE_WORKER_URL);
  maplibreModule = maplibre;
  return maplibre;
}
