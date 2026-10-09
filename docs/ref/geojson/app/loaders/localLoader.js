/**
 * 【役割】ローカルファイル（.geojson/.json/.zip）読み込み用の I/O 手続きを集約する。
 * 【レイヤ】Loader（ViewModel から呼ばれる）
 * 【依存】`BrowserDataGateway`（Zip解凍 / GeoJSON検証）
 */

/**
 * Loader の返り値（ViewModel が状態反映するための最小構造）。
 * @typedef {{ layers: Array<{ geojson: any, name: string, sourceLabel: string, zoom?: boolean }>, messages: Array<{type: string, text: string}> }} LoadResult
 */

/**
 * ローカルファイルを読み込み、レイヤ追加用の結果を返す。
 * - `.zip`: 解凍して中の GeoJSON を一括
 * - `.geojson`/`.json`: そのまま JSON パースして GeoJSON として扱う
 *
 * @param {{ extractGeoJsonFromZip: (file: File) => Promise<Array<{name: string, geojson: any}>>, readGeoJsonFromFile: (file: File) => Promise<any> }} dataSources
 * @param {File|null} file
 * @returns {Promise<LoadResult>}
 */
export async function loadFromLocalFile(dataSources, file) {
  if (!file) {
    return { layers: [], messages: [{ type: "warn", text: "ローカルファイルが選択されていません。" }] };
  }

  const name = String(file.name ?? "");
  const lower = name.toLowerCase();

  if (lower.endsWith(".zip")) {
    const items = await dataSources.extractGeoJsonFromZip(file);
    const layers = items.map((it) => ({ geojson: it.geojson, name: it.name, sourceLabel: "ローカル", zoom: true }));
    return {
      layers,
      messages: [{ type: "success", text: `ローカルZIPから ${layers.length} 件のGeoJSONを読み込みました。` }],
    };
  }

  // geojson/json
  const geojson = await dataSources.readGeoJsonFromFile(file);
  return {
    layers: [{ geojson, name, sourceLabel: "ローカル", zoom: true }],
    messages: [{ type: "success", text: "ローカルファイルを読み込みました。" }],
  };
}

