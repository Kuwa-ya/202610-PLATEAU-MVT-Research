/**
 * 京都駅周辺 z16 MVT ゲート（docs/design/kyoto-z16-gate.md）
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const snapshotPath = resolve(root, 'web/data/snapshot/plateau-datasets-2025.json');
const mvtDataRoot = resolve(root, 'web/data/mvt');

const KYOTO_STATION = { latitude: 34.986, longitude: 135.759 };
const FETCH_Z = 16;
const KYOTO_LUSE_LAYER = 'luse';

const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
  console.error(`FAIL: ${message}`);
}

function warn(message) {
  warnings.push(message);
  console.warn(`WARN: ${message}`);
}

function ok(message) {
  console.log(`OK: ${message}`);
}

function latLonToTile(latitude, longitude, zoom) {
  const lat = Math.max(-85.0511287798066, Math.min(85.0511287798066, latitude));
  const lon = ((longitude + 180) % 360 + 360) % 360 - 180;
  const scale = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * scale);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * scale);
  return { z: zoom, x, y };
}

function pickKyotoLuseEntry(datasets) {
  const candidates = datasets.filter(
    row => row.pref_code === '26' && row.type_en === 'luse' && row.city_code === '26100'
  );
  if (candidates.length === 0) throw new Error('スナップショットに京都市 (26100) luse がありません');
  return candidates.sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0];
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function checkDistribution(tile) {
  const { datasets } = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  const entry = pickKyotoLuseEntry(datasets);
  const tilejsonUrl =
    entry.composite_url
    ?? `https://api.plateauview.mlit.go.jp/datacatalog/mvt/${entry.city_code}-luse-${entry.year}/tilejson.json`;
  const tilejson = await fetchJson(tilejsonUrl);
  const maxzoom = tilejson.maxzoom ?? tilejson.maxZoom ?? 0;
  if (maxzoom < FETCH_Z) {
    fail(`TileJSON maxzoom=${maxzoom} < ${FETCH_Z}`);
  } else {
    ok(`TileJSON maxzoom=${maxzoom}`);
  }

  const template = tilejson.tiles?.[0];
  if (!template) {
    fail('TileJSON tiles[0] なし');
    return;
  }
  const mvtUrl = template
    .replace('{z}', String(tile.z))
    .replace('{x}', String(tile.x))
    .replace('{y}', String(tile.y));
  const mvtResponse = await fetch(mvtUrl);
  if (!mvtResponse.ok) {
    fail(`MVT HTTP ${mvtResponse.status}`);
    return;
  }
  const buffer = await mvtResponse.arrayBuffer();
  if (buffer.byteLength < 8) {
    fail(`MVT が空 (${buffer.byteLength} bytes)`);
    return;
  }
  ok(`MVT ${buffer.byteLength} bytes`);

  const vt = new VectorTile(new PbfReader(new Uint8Array(buffer)));
  const layer = vt.layers[KYOTO_LUSE_LAYER];
  if (!layer?.length) {
    fail(`レイヤ "${KYOTO_LUSE_LAYER}" に地物なし`);
    return;
  }
  let polygons = 0;
  for (let i = 0; i < layer.length; i += 1) {
    if (layer.feature(i).type === 3) polygons += 1;
  }
  if (polygons < 1) {
    fail('ポリゴン地物 0 件');
  } else {
    ok(`土地利用ポリゴン ${polygons} 件（レイヤ全 ${layer.length} 件）`);
  }
}

async function checkLocalIndex(tile) {
  const luseManifest = resolve(mvtDataRoot, 'manifest/luse-2025.json');
  if (!existsSync(luseManifest)) {
    warn('web/data/mvt/manifest/luse-2025.json なし — npm run build:mvt-index');
    return;
  }
  const parentX = Math.floor(tile.x / 16);
  const parentY = Math.floor(tile.y / 16);
  const indexPath = resolve(
    mvtDataRoot,
    `index/luse-2025/12/${parentX}/${parentY}.json`
  );
  if (!existsSync(indexPath)) {
    warn(`索引なし: ${indexPath}`);
    return;
  }
  const index = JSON.parse(readFileSync(indexPath, 'utf8'));
  const codes = index.tiles?.[`${tile.x}/${tile.y}`];
  if (!Array.isArray(codes) || codes.length === 0) {
    fail(`索引に z16 ${tile.x}/${tile.y} の市区コードなし`);
  } else {
    ok(`索引 luse z16/${tile.x}/${tile.y} → ${codes.join(',')}`);
  }
}

async function checkUseDistrict(tile) {
  const manifestPath = resolve(mvtDataRoot, 'manifest/use-district-2025.json');
  if (!existsSync(manifestPath)) {
    warn('用途地域 manifest なし — build:mvt-index:use-district');
    return;
  }
  const parentX = Math.floor(tile.x / 16);
  const parentY = Math.floor(tile.y / 16);
  const indexPath = resolve(
    mvtDataRoot,
    `index/use-district-2025/12/${parentX}/${parentY}.json`
  );
  if (!existsSync(indexPath)) {
    fail(`用途地域索引なし: ${indexPath}`);
    return;
  }
  const index = JSON.parse(readFileSync(indexPath, 'utf8'));
  const codes = index.tiles?.[`${tile.x}/${tile.y}`];
  if (!Array.isArray(codes) || codes.length === 0) {
    fail(`用途地域索引に z16 ${tile.x}/${tile.y} なし`);
    return;
  }
  ok(`索引 use-district z16/${tile.x}/${tile.y} → ${codes.join(',')}`);

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const cityCode = codes[0];
  const entry =
    manifest.cities.find(c => c.cityCode === cityCode && c.sourceLayer === 'UseDistrict')
    ?? manifest.cities.find(c => c.cityCode === cityCode);
  if (!entry?.mvtUrlTemplate) {
    fail(`manifest に ${cityCode} の MVT URL なし`);
    return;
  }
  const mvtUrl = entry.mvtUrlTemplate
    .replace('{z}', String(tile.z))
    .replace('{x}', String(tile.x))
    .replace('{y}', String(tile.y));
  const response = await fetch(mvtUrl);
  if (!response.ok) {
    fail(`用途地域 MVT HTTP ${response.status}`);
    return;
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength < 8) {
    fail('用途地域 MVT が空');
    return;
  }
  ok(`用途地域 MVT ${bytes.byteLength} bytes (${entry.sourceLayer})`);
}

async function main() {
  const tile = latLonToTile(KYOTO_STATION.latitude, KYOTO_STATION.longitude, FETCH_Z);
  console.log('京都 z16 ゲート', KYOTO_STATION, `tile ${tile.z}/${tile.x}/${tile.y}`);

  await checkDistribution(tile);
  await checkLocalIndex(tile);
  await checkUseDistrict(tile);

  console.log('');
  if (warnings.length) console.log(`警告 ${warnings.length} 件`);
  if (failures.length) {
    console.error(`\n不合格: ${failures.length} 件`);
    process.exitCode = 1;
  } else {
    console.log('\n合格');
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
