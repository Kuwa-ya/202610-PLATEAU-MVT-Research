/**
 * 京都駅周辺の z16 MVT を PLATEAU 配信から直接取得し、zoom 16 検証のたたき台とする。
 * 静的索引がなくても TileJSON → 1 タイルの取得可否を確認できる。
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

function pickKyotoLuseEntry(datasets) {
  const candidates = datasets.filter(
    row => row.pref_code === '26' && row.type_en === 'luse' && row.city_code === '26100'
  );
  if (candidates.length === 0) {
    throw new Error('スナップショットに京都市 (26100) の luse が見つかりません');
  }
  return candidates.sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0];
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function main() {
  const { datasets } = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  const entry = pickKyotoLuseEntry(datasets);
  const tile = latLonToTile(KYOTO_STATION.latitude, KYOTO_STATION.longitude, FETCH_Z);

  console.log('地点: 京都駅', KYOTO_STATION);
  console.log(`タイル: z${tile.z}/${tile.x}/${tile.y}`);
  console.log('データセット:', entry.id, entry.name);

  const tilejsonUrl = entry.composite_url
    ?? `https://api.plateauview.mlit.go.jp/datacatalog/mvt/${entry.city_code}-luse-${entry.year}/tilejson.json`;
  const tilejson = await fetchJson(tilejsonUrl);
  const template = tilejson.tiles?.[0];
  if (!template) throw new Error('TileJSON に tiles[0] がありません');

  const mvtUrl = template
    .replace('{z}', String(tile.z))
    .replace('{x}', String(tile.x))
    .replace('{y}', String(tile.y));

  console.log('maxzoom:', tilejson.maxzoom ?? tilejson.maxZoom ?? '—');
  console.log('MVT URL:', mvtUrl);

  const mvtResponse = await fetch(mvtUrl);
  console.log('MVT 取得:', mvtResponse.status, mvtResponse.headers.get('content-type') ?? '');
  if (!mvtResponse.ok) {
    process.exitCode = 1;
    return;
  }
  const buffer = await mvtResponse.arrayBuffer();
  console.log('MVT サイズ (bytes):', buffer.byteLength);
  if (buffer.byteLength < 8) {
    console.warn('タイルが空の可能性があります（境界外など）');
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
