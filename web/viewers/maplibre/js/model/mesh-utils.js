// Adapted from docs/ref/geojson/js/geometric/{japan-mesh-code,web-mesh-code}.js.
const DEG_TO_RAD = Math.PI / 180;
const MAX_WEB_MERCATOR_LAT = 85.0511287798066;
const JAPAN_BOUNDS = Object.freeze({ south: 20, west: 122, north: 46, east: 154 });

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

function meshCodeFromLatLon(latitude, longitude, digits = 8) {
  if (![4, 6, 8, 9, 10, 11].includes(digits)) {
    throw new RangeError(`未対応の地域メッシュ桁数です: ${digits}`);
  }
  const base = baseMesh(latitude, longitude);
  let { south, west } = base;
  if (digits <= 8) return base.code.slice(0, digits);

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

function meshBounds(meshCode) {
  if (!/^(?:\d{4}|\d{6}|\d{8}[1-4]{0,3})$/.test(meshCode)) {
    throw new RangeError(`地域メッシュコードが不正です: ${meshCode}`);
  }
  let south = Number(meshCode.slice(0, 2)) / 1.5;
  let west = Number(meshCode.slice(2, 4)) + 100;
  let height = 40 / 60;
  let width = 1;

  if (meshCode.length >= 6) {
    south += Number(meshCode[4]) * (5 / 60);
    west += Number(meshCode[5]) * (7.5 / 60);
    height = 5 / 60;
    width = 7.5 / 60;
  }
  if (meshCode.length >= 8) {
    south += Number(meshCode[6]) * (30 / 3600);
    west += Number(meshCode[7]) * (45 / 3600);
    height = 30 / 3600;
    width = 45 / 3600;
  }
  for (const digitText of meshCode.slice(8)) {
    const digit = Number(digitText);
    height /= 2;
    width /= 2;
    if (digit >= 3) south += height;
    if (digit === 2 || digit === 4) west += width;
  }
  return { south, west, north: south + height, east: west + width, height, width };
}

function meshCodesForBounds(bounds, limit = Infinity, digits = 8) {
  if (bounds.north <= bounds.south || bounds.east <= bounds.west) return [];
  const seed = meshBounds(meshCodeFromLatLon(bounds.south + 1e-12, bounds.west + 1e-12, digits));
  const codes = new Set();
  outer: for (let latitude = seed.south + seed.height / 2; latitude < bounds.north; latitude += seed.height) {
    for (let longitude = seed.west + seed.width / 2; longitude < bounds.east; longitude += seed.width) {
      const code = meshCodeFromLatLon(latitude, longitude, digits);
      const cell = meshBounds(code);
      if (cell.east > bounds.west && cell.west < bounds.east && cell.north > bounds.south && cell.south < bounds.north) {
        codes.add(code);
      }
      if (codes.size >= limit) break outer;
    }
  }
  return [...codes];
}

function latLonToTile(latitude, longitude, zoom) {
  const lat = Math.max(-MAX_WEB_MERCATOR_LAT, Math.min(MAX_WEB_MERCATOR_LAT, latitude));
  const lon = ((longitude + 180) % 360 + 360) % 360 - 180;
  const scale = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * scale);
  const latRad = lat * DEG_TO_RAD;
  const y = Math.floor((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * scale);
  return { x, y, z: zoom };
}

function tileBounds(x, y, zoom) {
  const scale = 2 ** zoom;
  const west = x / scale * 360 - 180;
  const east = (x + 1) / scale * 360 - 180;
  const north = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / scale))) / DEG_TO_RAD;
  const south = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / scale))) / DEG_TO_RAD;
  return { north, east, west, south };
}

function meshDigitsForZoom(zoom) {
  return zoom >= 18 ? 11 : zoom >= 17 ? 10 : zoom >= 16 ? 9 : zoom >= 14 ? 8 : zoom >= 10 ? 6 : 4;
}

function meshViewport(bounds, center, zoom) {
  const digits = meshDigitsForZoom(zoom);
  const limits = { 4: 2000, 6: 2500, 8: 600, 9: 900, 10: 1500, 11: 2500 };
  const clipped = {
    south: Math.max(JAPAN_BOUNDS.south, bounds.south),
    west: Math.max(JAPAN_BOUNDS.west, bounds.west),
    north: Math.min(JAPAN_BOUNDS.north, bounds.north),
    east: Math.min(JAPAN_BOUNDS.east, bounds.east)
  };
  const codes = meshCodesForBounds(clipped, limits[digits], digits);
  const centerInJapan = center.latitude >= JAPAN_BOUNDS.south
    && center.latitude <= JAPAN_BOUNDS.north
    && center.longitude >= JAPAN_BOUNDS.west
    && center.longitude <= JAPAN_BOUNDS.east;
  return {
    digits,
    codes,
    centerCode: centerInJapan ? meshCodeFromLatLon(center.latitude, center.longitude, digits) : null
  };
}

function webTileViewport(bounds, center, mapZoom, limit = 400) {
  const zoom = Math.max(0, Math.floor(mapZoom));
  const northwest = latLonToTile(bounds.north, bounds.west, zoom);
  const southeast = latLonToTile(bounds.south, bounds.east, zoom);
  const max = 2 ** zoom;
  const tiles = [];
  for (let y = Math.max(0, northwest.y); y <= Math.min(max - 1, southeast.y); y += 1) {
    for (let x = northwest.x; x <= southeast.x; x += 1) {
      tiles.push({ z: zoom, x: ((x % max) + max) % max, y });
      if (tiles.length >= limit) break;
    }
    if (tiles.length >= limit) break;
  }
  const centerTile = latLonToTile(center.latitude, center.longitude, zoom);
  return { zoom, tiles, centerCode: `${centerTile.z}/${centerTile.x}/${centerTile.y}` };
}

export const MeshUtils = Object.freeze({
  meshBounds,
  meshCodeFromLatLon,
  meshCodesForBounds,
  latLonToTile,
  tileBounds,
  meshViewport,
  webTileViewport
});

