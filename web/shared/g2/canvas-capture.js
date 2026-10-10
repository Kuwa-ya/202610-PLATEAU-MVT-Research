/*!
 * PLATEAU MVT Research — JavaScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: /legal/SOURCE-CODE-LICENSE.txt
 *
 * ALL RIGHTS RESERVED. NO LICENSE IS GRANTED BY ACCESSING, VIEWING, OR COPYING THIS FILE.
 * THIS SOFTWARE AND ALL ASSOCIATED MATERIALS ARE PROPRIETARY TO KUWA-YA, LTD.
 * SOURCE CODE IS MADE PUBLICLY VIEWABLE ONLY FOR TRANSPARENCY AND INFORMATIONAL
 * PURPOSES. WITHOUT PRIOR WRITTEN PERMISSION FROM KUWA-YA, LTD., YOU MAY NOT USE,
 * COPY, REPRODUCE, MODIFY, ADAPT, TRANSLATE, CREATE DERIVATIVE WORKS FROM,
 * DISTRIBUTE, REDISTRIBUTE, PUBLISH, SUBLICENSE, SELL, RENT, LEASE, OR OTHERWISE
 * MAKE AVAILABLE ANY PART OF THIS SOFTWARE, OR USE IT FOR COMMERCIAL PURPOSES OR
 * TO DEVELOP OR PROVIDE ANY PRODUCT OR SERVICE. VIEWING DOES NOT GRANT ANY RIGHTS.
 * USE OF THE PUBLIC WEB APPLICATION IS GOVERNED BY ITS TERMS OF SERVICE ONLY AND
 * DOES NOT GRANT ANY RIGHT TO THIS SOURCE CODE. THE SOFTWARE IS PROVIDED "AS IS"
 * WITHOUT WARRANTY OF ANY KIND. SEE /legal/SOURCE-CODE-LICENSE.txt.
 */

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
  const scale = Math.min(1, (options.maxWidth ?? 640) / Math.max(source.width, 1));
  return { blob, width: Math.max(1, Math.round(source.width * scale)) };
}
