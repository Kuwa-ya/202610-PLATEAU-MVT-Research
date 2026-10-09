/* Japanese regional mesh helpers. Corresponds to GeometricUtils/JapanMeshCode.cs. */
function baseMesh(latitude, longitude) {
  const firstLat = Math.floor(latitude * 1.5); const firstLon = Math.floor(longitude) - 100;
  let south = firstLat / 1.5; let west = firstLon + 100;
  const secondLat = Math.floor((latitude - south) / (5 / 60)); const secondLon = Math.floor((longitude - west) / (7.5 / 60));
  south += secondLat * (5 / 60); west += secondLon * (7.5 / 60);
  const thirdLat = Math.floor((latitude - south) / (30 / 3600)); const thirdLon = Math.floor((longitude - west) / (45 / 3600));
  south += thirdLat * (30 / 3600); west += thirdLon * (45 / 3600);
  return { code: `${String(firstLat).padStart(2, '0')}${String(firstLon).padStart(2, '0')}${secondLat}${secondLon}${thirdLat}${thirdLon}`, south, west };
}
export function meshCodeFromLatLon(latitude, longitude, digits = 8) {
  if (![4, 6, 8, 9, 10, 11].includes(digits)) throw new RangeError(`未対応の地域メッシュ桁数です: ${digits}`);
  const base = baseMesh(latitude, longitude); let { south, west } = base;
  if (digits <= 8) return base.code.slice(0, digits);
  let height = 30 / 3600; let width = 45 / 3600; let code = base.code;
  for (let level = 8; level < digits; level += 1) {
    height /= 2; width /= 2; const north = latitude >= south + height; const east = longitude >= west + width;
    code += String(1 + Number(east) + 2 * Number(north)); if (north) south += height; if (east) west += width;
  }
  return code;
}
export function meshBounds(meshCode) {
  if (!/^(?:\d{4}|\d{6}|\d{8}[1-4]{0,3})$/.test(meshCode)) throw new RangeError(`地域メッシュコードが不正です: ${meshCode}`);
  let south = Number(meshCode.slice(0, 2)) / 1.5; let west = Number(meshCode.slice(2, 4)) + 100;
  let height = 40 / 60; let width = 1;
  if (meshCode.length >= 6) {
    south += Number(meshCode[4]) * (5 / 60); west += Number(meshCode[5]) * (7.5 / 60);
    height = 5 / 60; width = 7.5 / 60;
  }
  if (meshCode.length >= 8) {
    south += Number(meshCode[6]) * (30 / 3600); west += Number(meshCode[7]) * (45 / 3600);
    height = 30 / 3600; width = 45 / 3600;
  }
  for (const digitText of meshCode.slice(8)) {
    const digit = Number(digitText); if (digit < 1 || digit > 4) throw new RangeError(`地域メッシュの分割番号が不正です: ${meshCode}`);
    height /= 2; width /= 2; if (digit >= 3) south += height; if (digit === 2 || digit === 4) west += width;
  }
  return { south, west, north: south + height, east: west + width, height, width };
}
export function meshCodesAround(latitude, longitude, radius = 1, digits = 11) {
  const centerBounds = meshBounds(meshCodeFromLatLon(latitude, longitude, digits));
  const centerLat = (centerBounds.south + centerBounds.north) / 2; const centerLon = (centerBounds.west + centerBounds.east) / 2; const cells = [];
  for (let y = radius; y >= -radius; y -= 1) for (let x = -radius; x <= radius; x += 1) cells.push({ code: meshCodeFromLatLon(centerLat + y * centerBounds.height, centerLon + x * centerBounds.width, digits), ring: Math.max(Math.abs(x), Math.abs(y)), distance: x * x + y * y });
  cells.sort((a, b) => a.ring - b.ring || a.distance - b.distance || a.code.localeCompare(b.code));
  return [...new Set(cells.map(cell => cell.code))];
}
export function meshCodesForBounds(bounds, limit = Infinity, digits = 8) {
  if (bounds.north <= bounds.south || bounds.east <= bounds.west) return [];
  const seed = meshBounds(meshCodeFromLatLon(bounds.south + 1e-12, bounds.west + 1e-12, digits)); const codes = new Set();
  outer: for (let latitude = seed.south + seed.height / 2; latitude < bounds.north; latitude += seed.height) for (let longitude = seed.west + seed.width / 2; longitude < bounds.east; longitude += seed.width) {
    const code = meshCodeFromLatLon(latitude, longitude, digits); const cell = meshBounds(code);
    if (cell.east > bounds.west && cell.west < bounds.east && cell.north > bounds.south && cell.south < bounds.north) codes.add(code);
    if (codes.size >= limit) break outer;
  }
  return [...codes];
}
export const thirdMeshCodeFromLatLon = (latitude, longitude) => meshCodeFromLatLon(latitude, longitude, 8);
export const thirdMeshBounds = meshBounds;
export const thirdMeshCodesForBounds = (bounds, limit = Infinity) => meshCodesForBounds(bounds, limit, 8);
export const regionalMeshCodeFromLatLon = (latitude, longitude) => meshCodeFromLatLon(latitude, longitude, 11);
export const regionalMeshCodesAround = (latitude, longitude, radius = 1) => meshCodesAround(latitude, longitude, radius, 11);
