import type { RegionalMeshBounds } from './mesh-code.js';

type LonLat = [number, number];

const DEG_TO_RAD = Math.PI / 180;

function fitMeshBoundsToCanvas(
  bounds: RegionalMeshBounds,
  width: number,
  height: number,
  padding: number
) {
  const midLat = (bounds.south + bounds.north) / 2;
  const geoW = (bounds.east - bounds.west) * Math.cos(midLat * DEG_TO_RAD);
  const geoH = bounds.north - bounds.south;
  const innerW = width - 2 * padding;
  const innerH = height - 2 * padding;
  const scale = Math.min(innerW / geoW, innerH / geoH);
  const drawW = geoW * scale;
  const drawH = geoH * scale;
  const offsetX = padding + (innerW - drawW) / 2;
  const offsetY = padding + (innerH - drawH) / 2;
  const lonSpan = bounds.east - bounds.west;
  const latSpan = bounds.north - bounds.south;

  const toX = (lon: number) => offsetX + ((lon - bounds.west) / lonSpan) * drawW;
  const toY = (lat: number) => offsetY + ((bounds.north - lat) / latSpan) * drawH;

  return { toX, toY, frame: { offsetX, offsetY, drawW, drawH } };
}

export type TopDownRenderOptions = {
  width: number;
  height: number;
  /** 読み込んだ 11 桁メッシュの範囲（この矩形にフィット） */
  bounds: RegionalMeshBounds;
  userLat: number;
  userLon: number;
  paddingPx?: number;
};

export function renderFootprintsTopDown(
  rings: LonLat[][],
  options: TopDownRenderOptions
): HTMLCanvasElement {
  const { width, height, bounds, userLat, userLon } = options;
  const padding = options.paddingPx ?? 6;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D コンテキストを取得できません');

  ctx.fillStyle = '#1a1f24';
  ctx.fillRect(0, 0, width, height);

  const { toX, toY, frame } = fitMeshBoundsToCanvas(bounds, width, height, padding);

  ctx.strokeStyle = 'rgba(58, 69, 80, 0.95)';
  ctx.lineWidth = 1;
  ctx.strokeRect(frame.offsetX, frame.offsetY, frame.drawW, frame.drawH);

  ctx.fillStyle = 'rgba(197, 203, 200, 0.92)';
  ctx.strokeStyle = 'rgba(90, 98, 104, 0.9)';

  for (const ring of rings) {
    ctx.beginPath();
    for (let i = 0; i < ring.length; i += 1) {
      const [lon, lat] = ring[i];
      const x = toX(lon);
      const y = toY(lat);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
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
    ctx.fillStyle = '#4af';
    ctx.beginPath();
    ctx.arc(toX(userLon), toY(userLat), 3, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

export async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('PNG 生成に失敗'))), 'image/png');
  });
  return new Uint8Array(await blob.arrayBuffer());
}
