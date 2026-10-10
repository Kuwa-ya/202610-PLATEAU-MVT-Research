/**
 * Even G2 向け: WebGL/Canvas を低解像度画像に変換（even-g2-3d-summary 検証 1）。
 */

/**
 * @param {HTMLCanvasElement} source
 * @param {{ maxWidth?: number, mimeType?: string, quality?: number }} options
 * @returns {Promise<Blob>}
 */
export async function canvasToImageBlob(source, options = {}) {
  const maxWidth = options.maxWidth ?? 640;
  const mimeType = options.mimeType ?? 'image/png';
  const quality = options.quality ?? 0.92;

  const scale = Math.min(1, maxWidth / Math.max(source.width, 1));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  const scratch = document.createElement('canvas');
  scratch.width = width;
  scratch.height = height;
  const ctx = scratch.getContext('2d');
  if (!ctx) throw new Error('2D コンテキストを取得できません');
  ctx.drawImage(source, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    scratch.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('画像の生成に失敗しました'));
    }, mimeType, quality);
  });
}

/** @param {HTMLCanvasElement} source @param {object} options */
export async function downloadCanvasPreview(source, filename = 'g2-preview.png', options = {}) {
  const blob = await canvasToImageBlob(source, options);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return { blob, width: Math.round(source.width * Math.min(1, (options.maxWidth ?? 640) / source.width)) };
}
