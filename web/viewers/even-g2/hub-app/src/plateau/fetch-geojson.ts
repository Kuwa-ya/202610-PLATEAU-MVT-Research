/*!
 * PLATEAU MVT Research — TypeScript source module
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

import type { GeoJsonFeatureCollection } from './geojson-types.js';

async function readMaybeGzipJson(response: Response): Promise<unknown> {
  const bytes = new Uint8Array(await response.arrayBuffer());
  const isGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  let text: string;
  if (!isGzip) {
    text = new TextDecoder().decode(bytes);
  } else if (typeof DecompressionStream === 'undefined') {
    throw new Error('gzip 展開に未対応のブラウザです');
  } else {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    text = await new Response(stream).text();
  }
  return JSON.parse(text);
}

export async function fetchBldgFeatureCollection(url: string, signal?: AbortSignal): Promise<GeoJsonFeatureCollection> {
  const response = await fetch(url, { signal, cache: 'default' });
  if (response.status === 404) {
    return { type: 'FeatureCollection', features: [] };
  }
  if (!response.ok) {
    throw new Error(`建物 GeoJSON: HTTP ${response.status}`);
  }
  const json = await readMaybeGzipJson(response);
  if (typeof json !== 'object' || json === null || (json as GeoJsonFeatureCollection).type !== 'FeatureCollection') {
    throw new TypeError('FeatureCollection ではありません');
  }
  return json as GeoJsonFeatureCollection;
}
