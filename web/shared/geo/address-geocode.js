/**
 * 住所 → 緯度経度（公開設定 JSON の address.api_key + sakura 住所 API）
 * @see https://www.kuwa-ya.co.jp/app/devegokko_v3_config.json
 */

import {
  addressGeocodeEndpointUrl,
  isLocalDevelopmentHost,
  loadDevegokkoClientConfig
} from './devegokko-client-config.js';

export {
  cameraDistanceForAddressMatch,
  formatMatchedAddress,
  normalizeAddress,
  resolveAddressMatchLevel
} from '/kuwaya-geo/js/foundation/geocode.js';

import {
  cameraDistanceForAddressMatch,
  formatMatchedAddress,
  normalizeAddress,
  resolveAddressMatchLevel
} from '/kuwaya-geo/js/foundation/geocode.js';

const LOCAL_GEOCODE_PATH = '/devegokko-api/address/geocode';

function usesLocalProxy() {
  if (typeof location === 'undefined') return false;
  return isLocalDevelopmentHost(location.hostname);
}

function resultFromFeature(feature) {
  const coordinates = feature?.geometry?.coordinates;
  const longitude = Number(coordinates?.[0]);
  const latitude = Number(coordinates?.[1]);
  if (feature?.geometry?.type !== 'Point' || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const properties = feature?.properties ?? {};
  const structuredAddress = properties.structured_address ?? properties.result ?? properties;
  return {
    ...properties,
    ...structuredAddress,
    output:
      properties.output
      ?? properties.matched_address
      ?? properties.formatted_address
      ?? structuredAddress.output
      ?? '',
    lat: latitude,
    lon: longitude
  };
}

function geocodeHttpError(status) {
  if (status === 400) throw new Error('住所を入力してください。');
  if (status === 401) throw new Error('住所検索APIの認証に失敗しました。');
  if (status === 503) throw new Error('住所検索APIが利用できるように設定されていません。');
  if (status === 502) throw new Error('住所検索APIで一時的なエラーが発生しました。');
  throw new Error('住所検索に失敗しました。時間をおいて再度お試しください。');
}

/** @returns {Promise<{ input: string, matchedAddress: string, matchDepth: string | null, cameraDistance: number, latitude: number, longitude: number, score: number, matchLevel: string, coordinateLevel: string }>} */
export async function geocodeAddress(address) {
  const queryAddress = normalizeAddress(address);
  if (!queryAddress) throw new Error('住所を入力してください。');

  const localProxy = usesLocalProxy();
  let url;
  const headers = { Accept: 'application/json' };

  if (localProxy) {
    url = new URL(LOCAL_GEOCODE_PATH, location.origin);
    url.searchParams.set('address', queryAddress);
  } else {
    const config = await loadDevegokkoClientConfig();
    url = new URL(addressGeocodeEndpointUrl(config.address));
    url.searchParams.set('address', queryAddress);
    headers['X-Address-Api-Key'] = config.address.api_key;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) geocodeHttpError(response.status);

  const payload = await response.json();
  const feature = payload?.type === 'FeatureCollection' && Array.isArray(payload.features)
    ? payload.features[0]
    : null;
  const result = resultFromFeature(feature);
  if (!Number.isFinite(result?.lat) || !Number.isFinite(result?.lon)) {
    throw new Error('該当する住所が見つかりませんでした。');
  }
  return {
    input: queryAddress,
    matchedAddress: formatMatchedAddress(result),
    matchDepth: resolveAddressMatchLevel(result),
    cameraDistance: cameraDistanceForAddressMatch(result),
    latitude: result.lat,
    longitude: result.lon,
    score: result.score ?? 0,
    matchLevel: result.match_level ?? '',
    coordinateLevel: result.coordinates_level ?? result.coordinate_level ?? ''
  };
}
