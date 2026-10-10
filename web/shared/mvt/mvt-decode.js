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
