import type { BuildingVolume } from './geojson-buildings.js';
import type { RegionalMeshBounds } from './mesh-code.js';
import { canvasToPngBytes } from './render-topdown.js';

const DEG_TO_RAD = Math.PI / 180;
/** 水平からの俯瞰角（約 45°） */
const VIEW_ELEVATION_RAD = Math.PI / 4;

type Point2 = { x: number; y: number };

function lonLatToMeters(
  lon: number,
  lat: number,
  centerLon: number,
  centerLat: number
): { east: number; north: number } {
  const cosLat = Math.cos(centerLat * DEG_TO_RAD);
  return {
    east: (lon - centerLon) * 111_320 * cosLat,
    north: (lat - centerLat) * 111_320
  };
}

/** 南側から北を見下ろす（水平 45°）。北＝奥、南＝手前 */
function obliqueMeters(east: number, north: number, heightM: number): Point2 {
  const cosE = Math.cos(VIEW_ELEVATION_RAD);
  const sinE = Math.sin(VIEW_ELEVATION_RAD);
  return {
    x: east,
    y: north * cosE + heightM * sinE
  };
}

function boundsCenter(bounds: RegionalMeshBounds) {
  return {
    lat: (bounds.south + bounds.north) / 2,
    lon: (bounds.west + bounds.east) / 2
  };
}

function collectProjectedPoints(
  buildings: BuildingVolume[],
  bounds: RegionalMeshBounds,
  userLat: number,
  userLon: number
): Point2[] {
  const center = boundsCenter(bounds);
  const points: Point2[] = [];

  const cornerLons = [bounds.west, bounds.east];
  const cornerLats = [bounds.south, bounds.north];
  for (const lat of cornerLats) {
    for (const lon of cornerLons) {
      const m = lonLatToMeters(lon, lat, center.lon, center.lat);
      points.push(obliqueMeters(m.east, m.north, 0));
    }
  }

  for (const building of buildings) {
    const h = building.heightM;
    for (const [lon, lat] of building.outer) {
      const m = lonLatToMeters(lon, lat, center.lon, center.lat);
      points.push(obliqueMeters(m.east, m.north, 0));
      points.push(obliqueMeters(m.east, m.north, h));
    }
  }

  const um = lonLatToMeters(userLon, userLat, center.lon, center.lat);
  points.push(obliqueMeters(um.east, um.north, 0));

  return points;
}

function fitProjectedPoints(
  points: Point2[],
  width: number,
  height: number,
  padding: number
) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minX)) {
    minX = -1;
    maxX = 1;
    minY = -1;
    maxY = 1;
  }
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const innerW = width - 2 * padding;
  const innerH = height - 2 * padding;
  const scale = Math.min(innerW / spanX, innerH / spanY);
  const drawW = spanX * scale;
  const drawH = spanY * scale;
  const offsetX = padding + (innerW - drawW) / 2;
  const offsetY = padding + (innerH - drawH) / 2;

  const toScreen = (p: Point2): Point2 => ({
    x: offsetX + (p.x - minX) * scale,
    y: offsetY + (maxY - p.y) * scale
  });

  return { toScreen, frame: { offsetX, offsetY, drawW, drawH } };
}

function buildingDepth(building: BuildingVolume, centerLon: number, centerLat: number): number {
  let sumNorth = 0;
  let sumEast = 0;
  for (const [lon, lat] of building.outer) {
    const m = lonLatToMeters(lon, lat, centerLon, centerLat);
    sumNorth += m.north;
    sumEast += m.east;
  }
  const n = building.outer.length;
  return -(sumNorth / n) * Math.cos(VIEW_ELEVATION_RAD) + (sumEast / n) * 0.15;
}

export type ObliqueRenderOptions = {
  width: number;
  height: number;
  bounds: RegionalMeshBounds;
  userLat: number;
  userLon: number;
  paddingPx?: number;
};

export function renderBuildingsOblique(
  buildings: BuildingVolume[],
  options: ObliqueRenderOptions
): HTMLCanvasElement {
  const { width, height, bounds, userLat, userLon } = options;
  const padding = options.paddingPx ?? 6;
  const center = boundsCenter(bounds);

  const projected = collectProjectedPoints(buildings, bounds, userLat, userLon);
  const { toScreen } = fitProjectedPoints(projected, width, height, padding);

  const projectRing = (ring: Array<[number, number, number]>, heightM: number): Point2[] =>
    ring.map(([lon, lat]) => {
      const m = lonLatToMeters(lon, lat, center.lon, center.lat);
      return toScreen(obliqueMeters(m.east, m.north, heightM));
    });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D コンテキストを取得できません');

  ctx.fillStyle = '#1a1f24';
  ctx.fillRect(0, 0, width, height);

  const sorted = [...buildings].sort(
    (a, b) => buildingDepth(a, center.lon, center.lat) - buildingDepth(b, center.lon, center.lat)
  );

  for (const building of sorted) {
    const ground = projectRing(building.outer, 0);
    const roof = projectRing(building.outer, building.heightM);
    const n = ground.length;

    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      const midLat = (building.outer[i][1] + building.outer[j][1]) / 2;
      const shade = midLat <= center.lat ? 0.72 : 0.55;
      ctx.fillStyle = `rgba(${Math.round(120 * shade)}, ${Math.round(128 * shade)}, ${Math.round(124 * shade)}, 0.95)`;
      ctx.beginPath();
      ctx.moveTo(ground[i].x, ground[i].y);
      ctx.lineTo(ground[j].x, ground[j].y);
      ctx.lineTo(roof[j].x, roof[j].y);
      ctx.lineTo(roof[i].x, roof[i].y);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(210, 216, 212, 0.95)';
    ctx.strokeStyle = 'rgba(70, 78, 84, 0.85)';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    for (let i = 0; i < n; i += 1) {
      const p = roof[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  if (
    userLon >= bounds.west
    && userLon <= bounds.east
    && userLat >= bounds.south
    && userLat <= bounds.north
  ) {
    const um = lonLatToMeters(userLon, userLat, center.lon, center.lat);
    const dot = toScreen(obliqueMeters(um.east, um.north, 0));
    ctx.fillStyle = '#4af';
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

export { canvasToPngBytes };
