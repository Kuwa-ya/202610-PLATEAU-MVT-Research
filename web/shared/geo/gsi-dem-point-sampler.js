/*!
 * PLATEAU MVT Research — 地理院 DEM PNG の点サンプル（G2 道路ドレープ等）
 */

const DEM_TILE_SIZE = 256;
const DEM1A_ZOOM = 17;
const DEM5A_ZOOM = 15;

function decodeElevation(red, green, blue) {
  const value = (red << 16) | (green << 8) | blue;
  if (value < 2 ** 23) return value * 0.01;
  if (value === 2 ** 23) return Number.NaN;
  return (value - 2 ** 24) * 0.01;
}

function latLonToGlobalPixel(latitude, longitude, zoom) {
  const scale = 2 ** zoom;
  const x = ((longitude + 180) / 360) * scale * DEM_TILE_SIZE;
  const latRad = (latitude * Math.PI) / 180;
  const y = ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * scale * DEM_TILE_SIZE;
  return { x, y };
}

async function loadDemTile(sourceId, z, x, y, signal) {
  const url = `https://cyberjapandata.gsi.go.jp/xyz/${sourceId}/${z}/${x}/${y}.png`;
  const response = await fetch(url, { signal });
  if (!response.ok) return null;
  const bitmap = await createImageBitmap(await response.blob(), { colorSpaceConversion: 'none' });
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(DEM_TILE_SIZE, DEM_TILE_SIZE)
    : Object.assign(document.createElement('canvas'), { width: DEM_TILE_SIZE, height: DEM_TILE_SIZE });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const rgba = ctx.getImageData(0, 0, DEM_TILE_SIZE, DEM_TILE_SIZE).data;
  const values = new Float64Array(DEM_TILE_SIZE * DEM_TILE_SIZE);
  for (let i = 0; i < values.length; i += 1) {
    const o = i * 4;
    values[i] = decodeElevation(rgba[o], rgba[o + 1], rgba[o + 2]);
  }
  return values;
}

function bilinearTile(values, localX, localY) {
  const x0 = Math.max(0, Math.min(DEM_TILE_SIZE - 1, Math.floor(localX)));
  const y0 = Math.max(0, Math.min(DEM_TILE_SIZE - 1, Math.floor(localY)));
  const x1 = Math.min(DEM_TILE_SIZE - 1, x0 + 1);
  const y1 = Math.min(DEM_TILE_SIZE - 1, y0 + 1);
  const tx = localX - x0;
  const ty = localY - y0;
  const corners = [
    [values[y0 * DEM_TILE_SIZE + x0], (1 - tx) * (1 - ty)],
    [values[y0 * DEM_TILE_SIZE + x1], tx * (1 - ty)],
    [values[y1 * DEM_TILE_SIZE + x0], (1 - tx) * ty],
    [values[y1 * DEM_TILE_SIZE + x1], tx * ty]
  ];
  let total = 0;
  let weight = 0;
  for (const [v, w] of corners) {
    if (!Number.isFinite(v)) continue;
    total += v * w;
    weight += w;
  }
  return weight > 0 ? total / weight : Number.NaN;
}

/** @returns {{ sample: (lat: number, lon: number) => Promise<number> }} */
export function createGsiDemPointSampler() {
  const tileCache = new Map();

  async function sampleAtZoom(latitude, longitude, zoom, sourceId, signal) {
    const global = latLonToGlobalPixel(latitude, longitude, zoom);
    const tileX = Math.floor(global.x / DEM_TILE_SIZE);
    const tileY = Math.floor(global.y / DEM_TILE_SIZE);
    const key = `${sourceId}:${zoom}/${tileX}/${tileY}`;
    let values = tileCache.get(key);
    if (!values) {
      values = await loadDemTile(sourceId, zoom, tileX, tileY, signal);
      if (values) tileCache.set(key, values);
    }
    if (!values) return Number.NaN;
    const localX = global.x - tileX * DEM_TILE_SIZE;
    const localY = global.y - tileY * DEM_TILE_SIZE;
    return bilinearTile(values, localX, localY);
  }

  return {
    async sample(latitude, longitude, signal) {
      const primary = await sampleAtZoom(latitude, longitude, DEM1A_ZOOM, 'dem1a_png', signal);
      if (Number.isFinite(primary)) return primary;
      const fallback = await sampleAtZoom(latitude, longitude, DEM5A_ZOOM, 'dem5a_png', signal);
      return Number.isFinite(fallback) ? fallback : Number.NaN;
    }
  };
}
