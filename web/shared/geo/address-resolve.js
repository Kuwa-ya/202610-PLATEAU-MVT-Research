import { getAddressDataBase } from './address-data-base.js';
import { findFeatureContainingPoint } from './point-in-geojson.js';

let citiesPromise = null;
const chomeCache = new Map();

async function loadCities() {
  if (!citiesPromise) {
    const base = getAddressDataBase();
    citiesPromise = fetch(`${base}/cities.geojson`)
      .then(async response => {
        if (!response.ok) throw new Error(`cities.geojson HTTP ${response.status}`);
        return response.json();
      })
      .then(doc => doc.features ?? []);
  }
  return citiesPromise;
}

async function loadChomePack(cityCode) {
  if (chomeCache.has(cityCode)) return chomeCache.get(cityCode);
  const base = getAddressDataBase();
  const request = fetch(`${base}/chome/${cityCode}.geojson`)
    .then(async response => {
      if (response.status === 404) return [];
      if (!response.ok) throw new Error(`chome/${cityCode} HTTP ${response.status}`);
      const doc = await response.json();
      return doc.features ?? [];
    })
    .catch(error => {
      console.warn('[address]', error.message);
      return [];
    });
  chomeCache.set(cityCode, request);
  return request;
}

/**
 * @returns {Promise<{ label: string, cityCode: string, level: 'chome'|'city'|null } | null>}
 */
export async function resolveAddressAtLonLat(latitude, longitude) {
  const cities = await loadCities();
  const cityFeature = findFeatureContainingPoint(cities, longitude, latitude);
  if (!cityFeature) return null;

  const cityCode = cityFeature.properties?.cityCode;
  const cityLabel = cityFeature.properties?.label ?? cityCode;
  if (!cityCode) return { label: cityLabel, cityCode: '', level: 'city' };

  const chomeFeatures = await loadChomePack(cityCode);
  const chomeFeature = findFeatureContainingPoint(chomeFeatures, longitude, latitude);
  if (chomeFeature?.properties?.label) {
    return { label: chomeFeature.properties.label, cityCode, level: 'chome' };
  }
  return { label: cityLabel, cityCode, level: 'city' };
}

/** テスト・再読込用 */
export function resetAddressCache() {
  citiesPromise = null;
  chomeCache.clear();
}
