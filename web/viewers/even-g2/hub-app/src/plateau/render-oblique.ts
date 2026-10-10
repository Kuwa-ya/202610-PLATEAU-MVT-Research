import type { BuildingVolume } from './geojson-buildings.js';
import type { RegionalMeshBounds } from './mesh-code.js';
import { canvasToPngBytes } from './render-topdown.js';

const DEG_TO_RAD = Math.PI / 180;
/** 水平面からの下向き視線角（南側カメラ・地上を見下ろす＝下からの見上げではない） */
const VIEW_ELEVATION_RAD = Math.PI / 4;

type Point2 = { x: number; y: number };

type SceneFrame = {
  userLat: number;
  userLon: number;
  pivotLat: number;
  headingDeg: number;
};

function enRelativeToUser(lon: number, lat: number, frame: SceneFrame): { east: number; north: number } {
  const cosLat = Math.cos(frame.pivotLat * DEG_TO_RAD);
  return {
    east: (lon - frame.userLon) * 111_320 * cosLat,
    north: (lat - frame.userLat) * 111_320
  };
}

function rotateEn(east: number, north: number, headingDeg: number): { east: number; north: number } {
  const rad = -headingDeg * DEG_TO_RAD;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { east: east * c - north * s, north: east * s + north * c };
}

/**
 * 南側から北へ向けた斜め投影（回転後 EN、高さ＝地上垂直の Z）。
 * heightM が増えると画面上方向へ伸びる（仰角・下からの見上げではない）。
 */
function obliqueFromEn(east: number, north: number, heightM: number): Point2 {
  const cosE = Math.cos(VIEW_ELEVATION_RAD);
  const sinE = Math.sin(VIEW_ELEVATION_RAD);
  return { x: east, y: north * cosE + heightM * sinE };
}

function projectLonLat(lon: number, lat: number, heightM: number, frame: SceneFrame): Point2 {
  const en = enRelativeToUser(lon, lat, frame);
  const rotated = rotateEn(en.east, en.north, frame.headingDeg);
  return obliqueFromEn(rotated.east, rotated.north, heightM);
}

function offsetMeters(lat: number, lon: number, northM: number, eastM: number) {
  const cosLat = Math.cos(lat * DEG_TO_RAD);
  return {
    lat: lat + northM / 111_320,
    lon: lon + eastM / (111_320 * Math.max(0.2, Math.abs(cosLat)))
  };
}

function collectProjectedPoints(
  buildings: BuildingVolume[],
  bounds: RegionalMeshBounds,
  frame: SceneFrame
): Point2[] {
  const points: Point2[] = [];
  const cornerLons = [bounds.west, bounds.east];
  const cornerLats = [bounds.south, bounds.north];
  for (const lat of cornerLats) {
    for (const lon of cornerLons) {
      points.push(projectLonLat(lon, lat, 0, frame));
    }
  }
  for (const building of buildings) {
    const h = building.heightM;
    for (const [lon, lat] of building.outer) {
      points.push(projectLonLat(lon, lat, 0, frame));
      points.push(projectLonLat(lon, lat, h, frame));
    }
  }
  points.push(projectLonLat(frame.userLon, frame.userLat, 0, frame));
  const hRad = frame.headingDeg * DEG_TO_RAD;
  const tip = offsetMeters(frame.userLat, frame.userLon, Math.cos(hRad) * 14, Math.sin(hRad) * 14);
  points.push(projectLonLat(tip.lon, tip.lat, 0, frame));
  return points;
}

function fitProjectedPoints(points: Point2[], width: number, height: number, padding: number) {
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
  const offsetX = padding + (innerW - spanX * scale) / 2;
  const offsetY = padding + (innerH - spanY * scale) / 2;

  const toScreen = (p: Point2): Point2 => ({
    x: offsetX + (p.x - minX) * scale,
    y: offsetY + (maxY - p.y) * scale
  });
  return { toScreen };
}

/** 奥行き（大きいほど手前＝南側カメラ）。後から描く */
function buildingDepthKey(building: BuildingVolume, frame: SceneFrame): number {
  let sum = 0;
  for (const [lon, lat] of building.outer) {
    const en = enRelativeToUser(lon, lat, frame);
    const { east, north } = rotateEn(en.east, en.north, frame.headingDeg);
    sum += north * Math.cos(VIEW_ELEVATION_RAD);
  }
  return sum / building.outer.length;
}

function ringEnPoints(ring: Array<[number, number, number]>, frame: SceneFrame) {
  return ring.map(([lon, lat]) => {
    const en = enRelativeToUser(lon, lat, frame);
    return rotateEn(en.east, en.north, frame.headingDeg);
  });
}

/** GeoJSON 外環の符号付き面積（反時計回りなら正） */
function signedAreaEn(points: Array<{ east: number; north: number }>): number {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.east * b.north - b.east * a.north;
  }
  return area / 2;
}

/** 南側カメラ向きの明暗（壁はすべて描画 — カリングしない） */
function wallShadeFactor(
  enRing: Array<{ east: number; north: number }>,
  edgeIndex: number,
  ccw: boolean
): number {
  const n = enRing.length;
  const en0 = enRing[edgeIndex];
  const en1 = enRing[(edgeIndex + 1) % n];
  const de = en1.east - en0.east;
  const outwardNorth = ccw ? -de : de;
  return outwardNorth < 0 ? 0.72 : 0.55;
}

export type ObliqueRenderOptions = {
  width: number;
  height: number;
  bounds: RegionalMeshBounds;
  userLat: number;
  userLon: number;
  /** 0=北が画面上、時計回り（進行方向が上向き） */
  headingDeg: number;
  paddingPx?: number;
};

export function renderBuildingsOblique(
  buildings: BuildingVolume[],
  options: ObliqueRenderOptions
): HTMLCanvasElement {
  const { width, height, bounds, userLat, userLon } = options;
  const padding = options.paddingPx ?? 6;
  const frame: SceneFrame = {
    userLat,
    userLon,
    pivotLat: userLat,
    headingDeg: options.headingDeg
  };

  const projected = collectProjectedPoints(buildings, bounds, frame);
  const { toScreen } = fitProjectedPoints(projected, width, height, padding);

  const projectRing = (ring: Array<[number, number, number]>, heightM: number): Point2[] =>
    ring.map(([lon, lat]) => toScreen(projectLonLat(lon, lat, heightM, frame)));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D コンテキストを取得できません');

  ctx.fillStyle = '#1a1f24';
  ctx.fillRect(0, 0, width, height);

  const sorted = [...buildings].sort(
    (a, b) => buildingDepthKey(a, frame) - buildingDepthKey(b, frame)
  );

  for (const building of sorted) {
    const enRing = ringEnPoints(building.outer, frame);
    const ccw = signedAreaEn(enRing) >= 0;
    const ground = projectRing(building.outer, 0);
    const roof = projectRing(building.outer, building.heightM);
    const n = ground.length;

    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      const shade = wallShadeFactor(enRing, i, ccw);
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
    const userPt = toScreen(projectLonLat(userLon, userLat, 0, frame));
    const hRad = frame.headingDeg * DEG_TO_RAD;
    const tipGeo = offsetMeters(userLat, userLon, Math.cos(hRad) * 14, Math.sin(hRad) * 14);
    const tipPt = toScreen(projectLonLat(tipGeo.lon, tipGeo.lat, 0, frame));

    ctx.strokeStyle = 'rgba(74, 175, 255, 0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(userPt.x, userPt.y);
    ctx.lineTo(tipPt.x, tipPt.y);
    ctx.stroke();

    ctx.fillStyle = '#4af';
    ctx.beginPath();
    ctx.arc(userPt.x, userPt.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

export { canvasToPngBytes };
