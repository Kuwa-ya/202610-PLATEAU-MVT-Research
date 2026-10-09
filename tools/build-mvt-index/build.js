import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DATA_YEAR,
  DATASETS,
  FETCH_Z,
  INDEX_Z,
  POC_BOUNDS,
  POC_PREF_CODES
} from './config.js';
import { fetchCityBbox } from './geojson-bbox.js';
import {
  boundsIntersect,
  tileBounds,
  tilesForBounds,
  tilesZ16InParent
} from './web-mercator.js';

const toolDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(toolDir, '..', '..');
const dataRoot = join(repoRoot, 'data');

const CATALOG_URL = 'https://api.plateauview.mlit.go.jp/datacatalog/plateau-datasets';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) return response.json();
    if (response.status === 429 || response.status >= 500) {
      await sleep(500 * (attempt + 1));
      continue;
    }
    throw new Error(`${url} → ${response.status}`);
  }
  throw new Error(`Failed: ${url}`);
}

function matchesDataset(row, dataset) {
  if (row.format !== 'MVT') return false;
  if (String(row.year) !== String(DATA_YEAR)) return false;
  if (!POC_PREF_CODES.includes(String(row.pref_code))) return false;
  const typeEn = String(row.type_en ?? '').toLowerCase();
  if (dataset.featureType === 'luse') return typeEn === 'luse';
  if (dataset.featureType === 'tran') {
    return typeEn === 'tran' && String(row.lod ?? '') === '1';
  }
  return false;
}

async function resolveTileJson(row, dataset) {
  const cityCode = row.city_code;
  const spec = `${cityCode}-${dataset.specSuffix}-${DATA_YEAR}`;
  const tilejsonUrl = row.composite_url
    ?? `https://api.plateauview.mlit.go.jp/datacatalog/mvt/${spec}/tilejson.json`;
  const tilejson = await fetchJson(tilejsonUrl);
  const template = tilejson.tiles?.[0];
  if (!template) throw new Error(`No tiles[] in ${tilejsonUrl}`);
  let sourceLayer = dataset.sourceLayer;
  const layerId = tilejson.vector_layers?.[0]?.id;
  if (layerId) sourceLayer = layerId;
  return {
    maxzoom: tilejson.maxzoom ?? FETCH_Z,
    minzoomCatalog: tilejson.minzoom ?? 10,
    mvtUrlTemplate: template,
    sourceLayer,
    tilejsonUrl
  };
}

async function buildManifest(dataset, catalogRows) {
  const rows = catalogRows.filter(row => matchesDataset(row, dataset));
  const cities = [];
  for (const row of rows) {
    const cityCode = String(row.city_code);
    const prefCode = String(row.pref_code);
    let bbox = await fetchCityBbox(cityCode, prefCode);
    if (!bbox) {
      console.warn(`  bbox 未取得: ${cityCode} ${row.city ?? ''}（索引精度が落ちます）`);
      continue;
    }
    await sleep(80);
    let tileMeta;
    try {
      tileMeta = await resolveTileJson(row, dataset);
    } catch (error) {
      console.warn(`  TileJSON スキップ: ${cityCode}`, error.message);
      continue;
    }
    cities.push({
      cityCode,
      prefCode,
      name: row.city ?? row.name ?? cityCode,
      spec: `${cityCode}-${dataset.specSuffix}-${DATA_YEAR}`,
      tilejsonUrl: tileMeta.tilejsonUrl,
      mvtUrlTemplate: tileMeta.mvtUrlTemplate,
      sourceLayer: tileMeta.sourceLayer,
      bbox
    });
  }
  cities.sort((a, b) => a.cityCode.localeCompare(b.cityCode));
  return {
    schemaVersion: 1,
    dataset: dataset.id,
    featureType: dataset.featureType,
    year: DATA_YEAR,
    maxzoom: FETCH_Z,
    minzoomCatalog: 10,
    cities
  };
}

function cityCodesForTile(tileBoundsGeo, cities) {
  const codes = [];
  for (const city of cities) {
    if (boundsIntersect(tileBoundsGeo, city.bbox)) codes.push(city.cityCode);
  }
  codes.sort((a, b) => Number(a) - Number(b));
  return [...new Set(codes)];
}

async function writeIndexParents(datasetId, cities) {
  const parents = tilesForBounds(POC_BOUNDS, INDEX_Z);
  if (parents.length !== 154) {
    console.warn(`  z12 親タイル数: ${parents.length}（設計値 154 と不一致）`);
  }
  let multiCandidate = 0;
  for (const parent of parents) {
    const childTiles = tilesZ16InParent(parent.x, parent.y, INDEX_Z, FETCH_Z);
    const tiles = {};
    for (const child of childTiles) {
      const bounds = tileBounds(child.x, child.y, FETCH_Z);
      const codes = cityCodesForTile(bounds, cities);
      const key = `${child.x}/${child.y}`;
      tiles[key] = codes;
      if (codes.length > 1) multiCandidate += 1;
    }
    const doc = {
      schemaVersion: 1,
      dataset: datasetId,
      parent: `${INDEX_Z}/${parent.x}/${parent.y}`,
      tiles
    };
    const outPath = join(dataRoot, 'index', datasetId, String(INDEX_Z), String(parent.x), `${parent.y}.json`);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, `${JSON.stringify(doc)}\n`, 'utf8');
  }
  return { parentCount: parents.length, multiCandidate };
}

async function main() {
  const snapshotPath = join(dataRoot, 'snapshot', `plateau-datasets-${DATA_YEAR}.json`);
  let catalog;
  if (existsSync(snapshotPath) && process.env.SKIP_CATALOG_FETCH === '1') {
    catalog = JSON.parse(await readFile(snapshotPath, 'utf8'));
  } else {
    console.log('カタログ取得中…');
    catalog = await fetchJson(CATALOG_URL);
    await mkdir(dirname(snapshotPath), { recursive: true });
    await writeFile(snapshotPath, `${JSON.stringify(catalog)}\n`, 'utf8');
  }
  const rows = catalog.datasets ?? [];
  await mkdir(join(dataRoot, 'manifest'), { recursive: true });

  for (const dataset of DATASETS) {
    console.log(`\n=== ${dataset.id} ===`);
    const manifest = await buildManifest(dataset, rows);
    const manifestPath = join(dataRoot, 'manifest', `${dataset.id}.json`);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`  manifest: ${manifest.cities.length} 市区`);
    const { parentCount, multiCandidate } = await writeIndexParents(dataset.id, manifest.cities);
    console.log(`  index: ${parentCount} 親 / 複数市区 z16: ${multiCandidate}`);
  }
  console.log('\n完了');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
