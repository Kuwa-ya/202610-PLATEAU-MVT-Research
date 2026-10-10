/*!
 * PLATEAU MVT Research — JavaScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: /legal/SOURCE-CODE-LICENSE.txt
 */

/** 地形サンプル失敗時（DEM 未読込など）の高さ — 従来のフラット MVT と同系 */
export const MVT_FLAT_Y = 1.2;

/** ドレープ時、サンプル標高からのオフセット（地面より上 — urf は低く、luse を上に） */
export const MVT_URF_DRAPE_OFFSET_M = 1;
export const MVT_LUSE_DRAPE_OFFSET_M = 2;

/**
 * ShapeGeometry（XZ 平面）の各頂点を緯度経度に戻し、sampleLocalY で Y を上書きする。
 * @param {THREE.BufferGeometry} geometry
 * @param {{ lat: number, lon: number }} origin
 * @param {(lat: number, lon: number) => number | null | undefined} sampleLocalY
 */
export function drapeBufferGeometryY(
  geometry,
  origin,
  metersPerDegLon,
  metersPerDegLat,
  sampleLocalY,
  offsetM
) {
  const position = geometry.getAttribute('position');
  if (!position || !sampleLocalY) return false;

  let draped = 0;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const lat = origin.lat - z / metersPerDegLat;
    const lon = origin.lon + x / metersPerDegLon;
    const localY = sampleLocalY(lat, lon);
    if (localY == null || !Number.isFinite(localY)) continue;
    position.setY(i, localY + offsetM);
    draped += 1;
  }
  if (!draped) return false;
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return true;
}
