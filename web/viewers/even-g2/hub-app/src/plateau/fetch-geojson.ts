import type { GeoJsonFeatureCollection } from './geojson-types.js';

async function readMaybeGzipJson(response: Response): Promise<unknown> {
  const bytes = new Uint8Array(await response.arrayBuffer());
  const isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  let text: string;
  if (!isGzip) {
    text = new TextDecoder().decode(bytes);
  } else if (typeof DecompressionStream === 'undefined') {
    throw new Error('gzip 展開に未対応のブラウザです');
  } else {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    text = await new Response(stream).text();
  }
  return JSON.parse(text);
}

export async function fetchBldgFeatureCollection(url: string, signal?: AbortSignal): Promise<GeoJsonFeatureCollection> {
  const response = await fetch(url, { signal, cache: 'default' });
  if (response.status === 404) {
    return { type: 'FeatureCollection', features: [] };
  }
  if (!response.ok) {
    throw new Error(`建物 GeoJSON: HTTP ${response.status}`);
  }
  const json = await readMaybeGzipJson(response);
  if (typeof json !== 'object' || json === null || (json as GeoJsonFeatureCollection).type !== 'FeatureCollection') {
    throw new TypeError('FeatureCollection ではありません');
  }
  return json as GeoJsonFeatureCollection;
}
