/**
 * 京都市 USE_DISTRICT（urf:UseDistrict）MVT のレイヤ名・属性を 1 タイルで確認する。
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const snapshotPath = resolve(root, 'web/data/snapshot/plateau-datasets-2025.json');
const KYOTO_STATION = { latitude: 34.986, longitude: 135.759 };
const FETCH_Z = 16;

function latLonToTile(latitude, longitude, zoom) {
  const lat = Math.max(-85.0511287798066, Math.min(85.0511287798066, latitude));
  const lon = ((longitude + 180) % 360 + 360) % 360 - 180;
  const scale = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * scale);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * scale);
  return { z: zoom, x, y };
}

function pickUseDistrictEntry(datasets) {
  const row = datasets.find(entry => entry.id === '26100_urf_UseDistrict_lod1');
  if (!row) throw new Error('京都市 UseDistrict MVT がスナップショットにありません');
  return row;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function main() {
  const { datasets } = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  const entry = pickUseDistrictEntry(datasets);
  const tile = latLonToTile(KYOTO_STATION.latitude, KYOTO_STATION.longitude, FETCH_Z);

  console.log('データセット:', entry.id);
  if (entry.composite_url) {
    const composite = await fetchJson(entry.composite_url);
    console.log('vector_layers (composite TileJSON):', composite.vector_layers?.map(layer => layer.id));
    console.log('注意: 京都市 urf の composite は複数地物型を束ねるため、UseDistrict は entry.url を直接使います');
  }

  const template = entry.url;
  console.log('sourceLayer 想定:', entry.layers?.[0] ?? 'UseDistrict');
  const mvtUrl = template
    .replace('{z}', String(tile.z))
    .replace('{x}', String(tile.x))
    .replace('{y}', String(tile.y));
  console.log('タイル:', `${tile.z}/${tile.x}/${tile.y}`);
  console.log('URL:', mvtUrl);

  const response = await fetch(mvtUrl);
  if (!response.ok) throw new Error(`MVT ${response.status}`);
  const buffer = await response.arrayBuffer();
  const vt = new VectorTile(new PbfReader(new Uint8Array(buffer)));

  for (const layerName of Object.keys(vt.layers)) {
    const layer = vt.layers[layerName];
    console.log(`\nレイヤ: ${layerName} features=${layer.length}`);
    for (let i = 0; i < Math.min(3, layer.length); i += 1) {
      console.log(`  [${i}]`, layer.feature(i).properties);
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
