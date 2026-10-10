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

let decodeReady;

function loadDecode() {
  if (!decodeReady) {
    decodeReady = Promise.all([import('@mapbox/vector-tile'), import('pbf')]).then(([vt, pbf]) => ({
      VectorTile: vt.VectorTile,
      PbfReader: pbf.PbfReader
    }));
  }
  return decodeReady;
}

export async function decodeMvt(arrayBuffer, sourceLayer) {
  const { VectorTile, PbfReader } = await loadDecode();
  const tile = new VectorTile(new PbfReader(new Uint8Array(arrayBuffer)));
  const layer = tile.layers[sourceLayer];
  if (!layer) {
    const names = Object.keys(tile.layers).join(', ') || '(なし)';
    throw new Error(`レイヤ "${sourceLayer}" がありません。利用可能: ${names}`);
  }
  const features = [];
  for (let i = 0; i < layer.length; i += 1) {
    const feature = layer.feature(i);
    features.push({
      type: feature.type,
      properties: feature.properties,
      geometry: feature.loadGeometry()
    });
  }
  return { features, extent: layer.extent || 4096 };
}
