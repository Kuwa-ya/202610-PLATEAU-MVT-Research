/*!
 * ちずうつし (kuwaya-geo) — JavaScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: ./legal/SOURCE-CODE-LICENSE.txt
 *
 * ALL RIGHTS RESERVED. NO LICENSE IS GRANTED BY ACCESSING, VIEWING, OR COPYING THIS FILE.
 * THIS SOFTWARE AND ALL ASSOCIATED MATERIALS ARE PROPRIETARY TO KUWA-YA, LTD.
 * SOURCE CODE IS MADE PUBLICLY VIEWABLE ONLY FOR TRANSPARENCY AND INFORMATIONAL
 * PURPOSES. WITHOUT PRIOR WRITTEN PERMISSION FROM KUWA-YA, LTD., YOU MAY NOT USE,
 * COPY, REPRODUCE, MODIFY, ADAPT, TRANSLATE, CREATE DERIVATIVE WORKS FROM,
 * DISTRIBUTE, REDISTRIBUTE, PUBLISH, SUBLICENSE, SELL, RENT, LEASE, OR OTHERWISE
 * MAKE AVAILABLE ANY PART OF THIS SOFTWARE, OR USE IT FOR COMMERCIAL PURPOSES OR
 * TO DEVELOP OR PROVIDE ANY PRODUCT OR SERVICE. VIEWING DOES NOT GRANT ANY RIGHTS.
 * USE OF THE PUBLIC WEB APPLICATION IS GOVERNED BY ITS TERMS OF SERVICE ONLY AND
 * DOES NOT GRANT ANY RIGHT TO THIS SOURCE CODE. THE SOFTWARE IS PROVIDED "AS IS"
 * WITHOUT WARRANTY OF ANY KIND. SEE ./legal/SOURCE-CODE-LICENSE.txt.
 */

import { ADDRESS_API_KEY, ADDRESS_GEOCODE_LOCAL_URL, ADDRESS_GEOCODE_URL } from '../config.js';

/** 地名部分（ハイフンなしで連結） */
const ADDRESS_BASE_FIELDS = [
  'pref', 'county', 'city', 'ward', 'oaza_cho', 'chome', 'koaza'
];

/** 丁目以降の番地・地番（ハイフンで区切って連結） */
const ADDRESS_NUMBER_FIELDS = [
  'blk_num', 'rsdt_num', 'rsdt_num2', 'prc_num1', 'prc_num2', 'prc_num3'
];

/** 住所マッチ粒度ごとのカメラ距離（m） */
const ADDRESS_MATCH_CAMERA_DISTANCE = {
  pref: 40_000,
  city: 12_000,
  oaza_cho: 4_000,
  chome: 1_200,
  blk_num: 400,
  rsdt_num: 120
};

function hasAddressPart(result, key) {
  const value = result?.[key];
  return value != null && String(value).trim() !== '';
}

/** @returns {'pref' | 'city' | 'oaza_cho' | 'chome' | 'blk_num' | 'rsdt_num' | null} */
export function resolveAddressMatchLevel(result) {
  if (
    hasAddressPart(result, 'rsdt_num')
    || hasAddressPart(result, 'rsdt_num2')
    || hasAddressPart(result, 'prc_num1')
    || hasAddressPart(result, 'prc_num2')
    || hasAddressPart(result, 'prc_num3')
  ) return 'rsdt_num';
  if (hasAddressPart(result, 'blk_num')) return 'blk_num';
  if (hasAddressPart(result, 'chome')) return 'chome';
  if (hasAddressPart(result, 'oaza_cho')) return 'oaza_cho';
  if (hasAddressPart(result, 'city') || hasAddressPart(result, 'ward')) return 'city';
  if (hasAddressPart(result, 'pref')) return 'pref';
  return null;
}

export function cameraDistanceForAddressMatch(result) {
  const level = resolveAddressMatchLevel(result);
  if (!level) return ADDRESS_MATCH_CAMERA_DISTANCE.chome;
  return ADDRESS_MATCH_CAMERA_DISTANCE[level];
}

function pickAddressParts(result, fields) {
  return fields
    .map(key => result?.[key])
    .filter(value => value != null && String(value).trim() !== '')
    .map(value => String(value).trim());
}

export function formatMatchedAddress(result) {
  const base = pickAddressParts(result, ADDRESS_BASE_FIELDS).join('');
  const numbers = pickAddressParts(result, ADDRESS_NUMBER_FIELDS);
  if (base || numbers.length > 0) {
    return base + (numbers.length > 0 ? numbers.join('-') : '');
  }
  return result?.output ?? '';
}

export function normalizeAddress(address) {
  return address.trim();
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
    output: properties.output
      ?? properties.matched_address
      ?? properties.formatted_address
      ?? structuredAddress.output
      ?? '',
    lat: latitude,
    lon: longitude
  };
}

function usesLocalProxy() {
  if (typeof location === 'undefined') return false;
  return location.hostname === 'localhost'
    || location.hostname === '127.0.0.1'
    || location.hostname === '[::1]';
}

/** @returns {Promise<{ input: string, matchedAddress: string, matchDepth: string | null, cameraDistance: number, latitude: number, longitude: number, score: number, matchLevel: string, coordinateLevel: string }>} */
export async function geocodeAddress(address) {
  const queryAddress = normalizeAddress(address);
  if (!queryAddress) throw new Error('住所を入力してください。');

  const localProxy = usesLocalProxy();
  const url = localProxy
    ? new URL(ADDRESS_GEOCODE_LOCAL_URL, location.origin)
    : new URL(ADDRESS_GEOCODE_URL);
  url.searchParams.set('address', queryAddress);
  const headers = { Accept: 'application/json' };
  if (!localProxy) headers['X-Address-Api-Key'] = ADDRESS_API_KEY;
  const response = await fetch(url, {
    headers
  });
  if (!response.ok) {
    if (response.status === 400) throw new Error('住所を入力してください。');
    if (response.status === 401) throw new Error('住所検索APIの認証に失敗しました。');
    if (response.status === 503) throw new Error('住所検索APIが利用できるように設定されていません。');
    if (response.status === 502) throw new Error('住所検索APIで一時的なエラーが発生しました。');
    throw new Error('住所検索に失敗しました。時間をおいて再度お試しください。');
  }

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
