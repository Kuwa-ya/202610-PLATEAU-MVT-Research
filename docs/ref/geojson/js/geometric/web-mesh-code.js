/* Web Mercator tile coordinates. Corresponds to GeometricUtils/WebMeshCode.cs. */
const DEG_TO_RAD = Math.PI / 180;
const MAX_WEB_MERCATOR_LAT = 85.0511287798066;
export function latLonToTile(latitude, longitude, zoom) {
  const lat = Math.max(-MAX_WEB_MERCATOR_LAT, Math.min(MAX_WEB_MERCATOR_LAT, latitude));
  const lon = ((longitude + 180) % 360 + 360) % 360 - 180;
  const scale = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * scale);
  const latRad = lat * DEG_TO_RAD;
  const y = Math.floor((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * scale);
  return { x, y, z: zoom };
}
export function tileBounds(x, y, zoom) {
  const scale = 2 ** zoom;
  const west = x / scale * 360 - 180; const east = (x + 1) / scale * 360 - 180;
  const north = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / scale))) / DEG_TO_RAD;
  const south = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / scale))) / DEG_TO_RAD;
  return { north, east, west, south };
}
export function createTileSquare(center, radius) {
  const tiles = [];
  for (let ring = 0; ring <= radius; ring += 1) for (let y = -ring; y <= ring; y += 1) for (let x = -ring; x <= ring; x += 1) {
    if (Math.max(Math.abs(x), Math.abs(y)) === ring) tiles.push({ z: center.z, x: center.x + x, y: center.y + y });
  }
  return tiles;
}
export function tileCenter(tile) {
  const bounds = tileBounds(tile.x, tile.y, tile.z);
  return { latitude: (bounds.north + bounds.south) / 2, longitude: (bounds.east + bounds.west) / 2 };
}
