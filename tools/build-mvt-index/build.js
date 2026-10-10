import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DATA_YEAR,
  DATASETS,
  FETCH_Z,
  INDEX_REGIONS,
  INDEX_Z,
  MVT_OUTPUT_RELATIVE,
  POC_PREF_CODES
} from './config.js';
import { fetchCityBbox } from './geojson-bbox.js';
import {
  bboxFromAdminBoundaries,
  cityTileIntersects,
  loadAdminBoundariesFromPaths
} from './admin-boundaries.js';
import {
  tileBounds,
  tilesForBounds,
  tilesZ16InParent
} from './web-mercator.js';

const toolDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(toolDir, '..', '..');
const dataRoot = join(repoRoot, 'web', 'data');
const ADMIN_BOUNDARY_PATHS = INDEX_REGIONS.map(region => join(dataRoot, region.boundariesRelative));

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

async function buildManifest(dataset, catalogRows, adminBoundaries) {
  const rows = catalogRows.filter(row => matchesDataset(row, dataset));
  const cities = [];
  for (const row of rows) {
    const cityCode = String(row.city_code);
    const prefCode = String(row.pref_code);
    let bbox = await fetchCityBbox(cityCode, prefCode);
    if (!bbox) bbox = bboxFromAdminBoundaries(cityCode, adminBoundaries);
    if (!bbox) {
      console.warn(`  bbox 未取得: ${cityCode} ${row.city ?? ''}（索引から除外）`);
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

function cityCodesForTile(tileBoundsGeo, cities, adminBoundaries) {
  const codes = [];
  for (const city of cities) {
    if (cityTileIntersects(city, tileBoundsGeo, adminBoundaries)) codes.push(city.cityCode);
  }
  codes.sort((a, b) => Number(a) - Number(b));
  return [...new Set(codes)];
}

async function writeIndexParentsForRegion(datasetId, cities, adminBoundaries, regionBounds) {
  const parents = tilesForBounds(regionBounds, INDEX_Z);
  let multiCandidate = 0;
  for (const parent of parents) {
    const childTiles = tilesZ16InParent(parent.x, parent.y, INDEX_Z, FETCH_Z);
    const tiles = {};
    for (const child of childTiles) {
      const bounds = tileBounds(child.x, child.y, FETCH_Z);
      const codes = cityCodesForTile(bounds, cities, adminBoundaries);
      const key = `${child.x}/${child.y}`;
      if (codes.length) tiles[key] = codes;
      if (codes.length > 1) multiCandidate += 1;
    }
    const outPath = join(
      dataRoot,
      MVT_OUTPUT_RELATIVE,
      'index',
      datasetId,
      String(INDEX_Z),
      String(parent.x),
      `${parent.y}.json`
    );
    await mkdir(dirname(outPath), { recursive: true });
    const doc = {
      schemaVersion: 1,
      dataset: datasetId,
      parent: `${INDEX_Z}/${parent.x}/${parent.y}`,
      tiles
    };
    await writeFile(outPath, `${JSON.stringify(doc)}\n`, 'utf8');
  }
  return { parentCount: parents.length, multiCandidate };
}

async function writeMvtOutputs(datasetId, manifest, adminBoundaries) {
  const manifestPath = join(dataRoot, MVT_OUTPUT_RELATIVE, 'manifest', `${datasetId}.json`);
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`  manifest: ${manifest.cities.length} 市区`);

  let parentCount = 0;
  let multiCandidate = 0;
  for (const region of INDEX_REGIONS) {
    const result = await writeIndexParentsForRegion(
      datasetId,
      manifest.cities,
      adminBoundaries,
      region.bounds
    );
    parentCount += result.parentCount;
    multiCandidate += result.multiCandidate;
    console.log(`  index (${region.id}): ${result.parentCount} 親`);
  }
  const kantoParents = tilesForBounds(INDEX_REGIONS[0].bounds, INDEX_Z);
  if (kantoParents.length !== 154) {
    console.warn(`  z12 親タイル数 (kanto): ${kantoParents.length}（設計値 154 と不一致）`);
  }
  return { parentCount, multiCandidate };
}

async function main() {
  const adminBoundaries = await loadAdminBoundariesFromPaths(ADMIN_BOUNDARY_PATHS);
  console.log(`Admin boundaries: ${adminBoundaries.size} exact polygons`);
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

  for (const dataset of DATASETS) {
    console.log(`\n=== ${dataset.id} ===`);
    const manifestPath = join(dataRoot, MVT_OUTPUT_RELATIVE, 'manifest', `${dataset.id}.json`);
    const manifest = process.env.REUSE_MANIFESTS === '1' && existsSync(manifestPath)
      ? JSON.parse(await readFile(manifestPath, 'utf8'))
      : await buildManifest(dataset, rows, adminBoundaries);
    const { parentCount, multiCandidate } = await writeMvtOutputs(
      dataset.id, manifest, adminBoundaries
    );
    console.log(`  index 合計: ${parentCount} 親 / 複数市区 z16: ${multiCandidate}`);
  }
  console.log('\n完了 → web/data/mvt/');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
