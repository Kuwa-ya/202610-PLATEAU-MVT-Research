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

import {
  createFeature,
  createFeatureCollection,
  createGeometry,
  isFeature,
  isFeatureCollection
} from './geojson-models.js';

export function deserializeFeatureCollection(json) {
  const value = typeof json === 'string' ? JSON.parse(json) : json;
  if (!isFeatureCollection(value)) throw new TypeError('GeoJSON FeatureCollectionではありません。');
  return value;
}

export function cloneFeatureCollection(collection) {
  return structuredClone(collection);
}

export function geometryOnlyFeatureCollection(collection) {
  return createFeatureCollection((collection.features ?? [])
    .filter(isFeature)
    .map(feature => createFeature({ geometry: feature.geometry })));
}

export function geometryFromCoordinates(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 4) return null;
  const ring = coordinates.map(point => [...point]);
  const first = ring[0];
  const last = ring.at(-1);
  const same = first.length === last.length && first.every((value, index) => value === last[index]);
  if (!same) ring.push([...first]);
  return createGeometry('Polygon', [ring]);
}

export function featureFromCoordinates(coordinates) {
  const geometry = geometryFromCoordinates(coordinates);
  return geometry ? createFeature({ geometry }) : null;
}

export function polygonsFromGeometry(geometry) {
  if (geometry?.type === 'Polygon') return [geometry.coordinates];
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}
