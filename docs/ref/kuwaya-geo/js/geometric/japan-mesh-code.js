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

function baseMesh(latitude, longitude) {
  const firstLat = Math.floor(latitude * 1.5);
  const firstLon = Math.floor(longitude) - 100;
  let south = firstLat / 1.5;
  let west = firstLon + 100;
  const secondLat = Math.floor((latitude - south) / (5 / 60));
  const secondLon = Math.floor((longitude - west) / (7.5 / 60));
  south += secondLat * (5 / 60);
  west += secondLon * (7.5 / 60);
  const thirdLat = Math.floor((latitude - south) / (30 / 3600));
  const thirdLon = Math.floor((longitude - west) / (45 / 3600));
  south += thirdLat * (30 / 3600);
  west += thirdLon * (45 / 3600);
  return {
    code: `${String(firstLat).padStart(2, '0')}${String(firstLon).padStart(2, '0')}${secondLat}${secondLon}${thirdLat}${thirdLon}`,
    south,
    west
  };
}

export function meshCodeFromLatLon(latitude, longitude, digits = 8) {
  if (![8, 9, 10, 11].includes(digits)) throw new RangeError(`未対応の地域メッシュ桁数です: ${digits}`);
  const base = baseMesh(latitude, longitude);
  let { south, west } = base;
  let height = 30 / 3600;
  let width = 45 / 3600;
  let code = base.code;
  for (let level = 8; level < digits; level += 1) {
    height /= 2;
    width /= 2;
    const north = latitude >= south + height;
    const east = longitude >= west + width;
    code += String(1 + Number(east) + 2 * Number(north));
    if (north) south += height;
    if (east) west += width;
  }
  return code;
}

export function meshBounds(meshCode) {
  if (!/^\d{8,11}$/.test(meshCode)) throw new RangeError(`8〜11桁の地域メッシュコードではありません: ${meshCode}`);
  let south = Number(meshCode.slice(0, 2)) / 1.5;
  let west = Number(meshCode.slice(2, 4)) + 100;
  south += Number(meshCode[4]) * (5 / 60);
  west += Number(meshCode[5]) * (7.5 / 60);
  south += Number(meshCode[6]) * (30 / 3600);
  west += Number(meshCode[7]) * (45 / 3600);
  let height = 30 / 3600;
  let width = 45 / 3600;
  for (const digitText of meshCode.slice(8)) {
    const digit = Number(digitText);
    if (digit < 1 || digit > 4) throw new RangeError(`地域メッシュの分割番号が不正です: ${meshCode}`);
    height /= 2;
    width /= 2;
    if (digit >= 3) south += height;
    if (digit === 2 || digit === 4) west += width;
  }
  return { south, west, north: south + height, east: west + width, height, width };
}

export function meshCodesAround(latitude, longitude, radius = 1, digits = 11) {
  const centerBounds = meshBounds(meshCodeFromLatLon(latitude, longitude, digits));
  const centerLat = (centerBounds.south + centerBounds.north) / 2;
  const centerLon = (centerBounds.west + centerBounds.east) / 2;
  const cells = [];
  for (let y = radius; y >= -radius; y -= 1) {
    for (let x = -radius; x <= radius; x += 1) {
      cells.push({
        code: meshCodeFromLatLon(centerLat + y * centerBounds.height, centerLon + x * centerBounds.width, digits),
        ring: Math.max(Math.abs(x), Math.abs(y)),
        distance: x * x + y * y
      });
    }
  }
  cells.sort((a, b) => a.ring - b.ring || a.distance - b.distance || a.code.localeCompare(b.code));
  return [...new Set(cells.map(cell => cell.code))];
}

export function meshCodesForBounds(bounds, limit = Infinity, digits = 8) {
  if (bounds.north <= bounds.south || bounds.east <= bounds.west) return [];
  const seed = meshBounds(meshCodeFromLatLon(bounds.south + 1e-12, bounds.west + 1e-12, digits));
  const codes = new Set();
  outer: for (let latitude = seed.south + seed.height / 2; latitude < bounds.north; latitude += seed.height) {
    for (let longitude = seed.west + seed.width / 2; longitude < bounds.east; longitude += seed.width) {
      const code = meshCodeFromLatLon(latitude, longitude, digits);
      const cell = meshBounds(code);
      if (cell.east > bounds.west && cell.west < bounds.east && cell.north > bounds.south && cell.south < bounds.north) codes.add(code);
      if (codes.size >= limit) break outer;
    }
  }
  return [...codes];
}

export const thirdMeshCodeFromLatLon = (latitude, longitude) => meshCodeFromLatLon(latitude, longitude, 8);
export function thirdMeshBounds(meshCode) {
  if (!/^\d{8}$/.test(meshCode)) throw new RangeError(`8桁三次メッシュコードではありません: ${meshCode}`);
  return meshBounds(meshCode);
}
export const thirdMeshCodesForBounds = (bounds, limit = Infinity) => meshCodesForBounds(bounds, limit, 8);
export const regionalMeshCodeFromLatLon = (latitude, longitude) => meshCodeFromLatLon(latitude, longitude, 11);
export const regionalMeshCodesAround = (latitude, longitude, radius = 1) => meshCodesAround(latitude, longitude, radius, 11);
