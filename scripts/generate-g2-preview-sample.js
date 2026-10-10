/**
 * G2 hub-app / ブラウザ確認用のプレースホルダー PNG（640×320, 2:1）。
 * 実行: node scripts/generate-g2-preview-sample.js
 */
import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WIDTH = 640;
const HEIGHT = 320;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** @returns {Uint8Array} RGBA */
function renderFrame() {
  const data = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const i = (y * WIDTH + x) * 4;
      const nx = x / WIDTH;
      const ny = y / HEIGHT;
      const sky = ny < 0.42 ? 1 : 0;
      const skyR = lerp(18, 42, nx);
      const skyG = lerp(32, 58, nx);
      const skyB = lerp(48, 72, nx);
      const groundR = lerp(28, 52, nx);
      const groundG = lerp(48, 78, nx);
      const groundB = lerp(38, 62, nx);
      let r = sky ? skyR : groundR;
      let g = sky ? skyG : groundG;
      let b = sky ? skyB : groundB;

      const hill = Math.sin(nx * 6.2 + 0.4) * 0.08 + Math.cos(nx * 2.1) * 0.05;
      const elev = ny - 0.42 - hill;
      if (elev > 0 && elev < 0.35) {
        const shade = 1 - elev * 1.8;
        r = lerp(36, 92, shade);
        g = lerp(72, 128, shade);
        b = lerp(52, 88, shade);
      }

      const blocks = [
        { x0: 0.12, x1: 0.28, y0: 0.52, y1: 0.72, cr: 72, cg: 118, cb: 82 },
        { x0: 0.3, x1: 0.48, y0: 0.48, y1: 0.7, cr: 88, cg: 132, cb: 76 },
        { x0: 0.5, x1: 0.68, y0: 0.55, y1: 0.78, cr: 58, cg: 102, cb: 68 },
        { x0: 0.62, x1: 0.82, y0: 0.5, y1: 0.68, cr: 96, cg: 140, cb: 90 },
        { x0: 0.35, x1: 0.55, y0: 0.72, y1: 0.88, cr: 120, cg: 118, cb: 72 },
        { x0: 0.18, x1: 0.38, y0: 0.74, y1: 0.9, cr: 140, cg: 128, cb: 78 }
      ];
      for (const block of blocks) {
        if (nx >= block.x0 && nx <= block.x1 && ny >= block.y0 && ny <= block.y1) {
          const depth = (ny - block.y0) / (block.y1 - block.y0);
          r = block.cr * (0.75 + depth * 0.35);
          g = block.cg * (0.75 + depth * 0.35);
          b = block.cb * (0.75 + depth * 0.35);
        }
      }

      const roadY = 0.62 + Math.sin(nx * 8) * 0.012;
      if (Math.abs(ny - roadY) < 0.018 && nx > 0.08 && nx < 0.92) {
        r = 118;
        g = 98;
        b = 72;
      }

      data[i] = clamp(Math.round(r), 0, 255);
      data[i + 1] = clamp(Math.round(g), 0, 255);
      data[i + 2] = clamp(Math.round(b), 0, 255);
      data[i + 3] = 255;
    }
  }
  return data;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(rgba, width, height) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

async function main() {
  const rgba = renderFrame();
  const png = encodePng(Buffer.from(rgba), WIDTH, HEIGHT);
  const previewDir = join(root, 'web', 'data', 'output', 'previews');
  const targets = [
    join(previewDir, 'preview.png'),
    join(previewDir, 'sample-preview.png')
  ];
  for (const out of targets) {
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, png);
    console.log(`Wrote ${out} (${png.length} bytes)`);
  }

  const hubPublic = join(root, 'web', 'viewers', 'even-g2', 'hub-app', 'public', 'preview.png');
  await mkdir(dirname(hubPublic), { recursive: true });
  await writeFile(hubPublic, png);
  console.log(`Wrote ${hubPublic} (${png.length} bytes)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
