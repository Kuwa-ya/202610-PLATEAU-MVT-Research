/**
 * docs/ref の市区町村・町丁目 GeoJSON を G2 / web 配信用に分割。
 * 出力: web/data/address/cities.geojson, chome/{cityCode}.geojson, manifest.json
 *
 * 正本・差し替え手順: docs/ref/address-data.md
 * 生成物 web/data/address/ は .gitignore（npm run build:address-pack で再生成）
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const refDir = join(root, 'docs', 'ref');
const outDir = join(root, 'web', 'data', 'address');

/** 住基町丁目・字等（r2ka）— PREF(2) + CITY(3) → 例: 26106, 13101 */
function r2kaCityCode(props) {
  const pref = String(props.PREF ?? '').padStart(2, '0');
  const city = String(props.CITY ?? '').padStart(3, '0');
  if (!pref || city === '000') return '';
  return `${pref}${city}`;
}

const DATASETS = [
  {
    id: 'kyoto-r2ka26',
    cityFile: 'r2ka26_city.geojson',
    chomeFile: 'r2ka26_convert.geojson',
    cityCodeFromProps: r2kaCityCode,
    chomeCityCode: r2kaCityCode
  },
  {
    id: 'tokyo-r2ka13',
    cityFile: 'r2ka13_city.geojson',
    chomeFile: 'r2ka13_convert.geojson',
    cityCodeFromProps: r2kaCityCode,
    chomeCityCode: r2kaCityCode
  }
];

function labelFromCityProps(props) {
  const pref = props.PREF_NAME ?? '';
  const city = props.CITY_NAME ?? '';
  return `${pref}${city}`.replace(/\s+/g, '');
}

function labelFromChomeProps(props) {
  const base = labelFromCityProps(props);
  const sName = props.S_NAME ?? '';
  return sName ? `${base}${sName}` : base;
}

async function loadJson(name) {
  const text = await readFile(join(refDir, name), 'utf8');
  return JSON.parse(text);
}

async function main() {
  const cityFeatures = [];
  const chomeByCity = new Map();

  for (const ds of DATASETS) {
    const cityFc = await loadJson(ds.cityFile);
    for (const feature of cityFc.features ?? []) {
      const cityCode = ds.cityCodeFromProps(feature.properties ?? {});
      if (!cityCode) continue;
      cityFeatures.push({
        type: 'Feature',
        properties: {
          cityCode,
          label: labelFromCityProps(feature.properties ?? {}),
          dataset: ds.id
        },
        geometry: feature.geometry
      });
    }

    const chomeFc = await loadJson(ds.chomeFile);
    for (const feature of chomeFc.features ?? []) {
      const cityCode = ds.chomeCityCode(feature.properties ?? {});
      if (!cityCode) continue;
      if (!chomeByCity.has(cityCode)) chomeByCity.set(cityCode, []);
      chomeByCity.get(cityCode).push({
        type: 'Feature',
        properties: {
          cityCode,
          label: labelFromChomeProps(feature.properties ?? {}),
          sName: feature.properties?.S_NAME ?? null
        },
        geometry: feature.geometry
      });
    }
  }

  await mkdir(join(outDir, 'chome'), { recursive: true });

  const cities = { type: 'FeatureCollection', features: cityFeatures };
  await writeFile(join(outDir, 'cities.geojson'), JSON.stringify(cities));

  const cityCodes = [];
  for (const [cityCode, features] of chomeByCity.entries()) {
    cityCodes.push(cityCode);
    const fc = { type: 'FeatureCollection', features };
    await writeFile(join(outDir, 'chome', `${cityCode}.geojson`), JSON.stringify(fc));
  }

  cityCodes.sort((a, b) => Number(a) - Number(b));
  const manifest = {
    schemaVersion: 1,
    generatedFrom: DATASETS.map(d => ({ id: d.id, city: d.cityFile, chome: d.chomeFile })),
    cityCount: cityFeatures.length,
    chomePackCount: cityCodes.length,
    cityCodes
  };
  await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(
    `address pack: ${cityFeatures.length} cities, ${cityCodes.length} chome packs → ${outDir}`
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
