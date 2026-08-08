// src/lib/maplibre-setup.ts — import this (for its side effect) before constructing any
// maplibregl.Map. See scripts/copy-maplibre-worker.mjs for the full explanation: under
// Turbopack, maplibre-gl 6.x's runtime worker-URL detection resolves to "", so
// `new Worker("", {type:"module"})` throws and no `.pbf` tile is ever fetched — the style
// background and DOM markers still render, which is what made the bug easy to miss.
//
// Fix: point maplibre-gl at a same-origin static copy of its worker script instead of
// letting it derive the URL from `import.meta.url`.
import * as maplibregl from 'maplibre-gl'

// Guarded so the vitest `vi.mock('maplibre-gl', ...)` mocks (which only export the
// symbols each test needs, e.g. Map/Marker) stay unaffected. A plain `typeof
// maplibregl.setWorkerUrl === 'function'` check is not enough here: Vitest's mocked
// module is a Proxy that *throws* on reading a property the mock factory didn't return
// ("No setWorkerUrl export is defined on the maplibre-gl mock"), rather than yielding
// `undefined` like a normal object would — so the read itself needs the try/catch.
try {
  if (typeof maplibregl.setWorkerUrl === 'function') {
    maplibregl.setWorkerUrl('/maplibre-gl-worker.js')
  }
} catch {
  // running against a mock (or an older maplibre-gl) that doesn't export setWorkerUrl
}
