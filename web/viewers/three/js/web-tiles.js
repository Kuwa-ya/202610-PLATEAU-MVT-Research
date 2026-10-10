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
  const west = (x / scale) * 360 - 180;
  const east = ((x + 1) / scale) * 360 - 180;
  const north = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / scale))) / DEG_TO_RAD;
  const south = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / scale))) / DEG_TO_RAD;
  return { north, east, west, south };
}

export function tilesForBounds(bounds, zoom) {
  const northWest = latLonToTile(bounds.north, bounds.west, zoom);
  const southEast = latLonToTile(bounds.south + 1e-12, bounds.east - 1e-12, zoom);
  const tiles = [];
  for (let y = northWest.y; y <= southEast.y; y += 1) {
    for (let x = northWest.x; x <= southEast.x; x += 1) {
      tiles.push({ z: zoom, x, y });
    }
  }
  return tiles;
}

export function parentKeyForChild(childX, childY, childZ, parentZ) {
  const shift = childZ - parentZ;
  const div = 2 ** shift;
  return `${parentZ}/${Math.floor(childX / div)}/${Math.floor(childY / div)}`;
}
