/**
 * 【役割】URL 読み込み用の I/O 手続きを集約する。
 * 【レイヤ】Loader（ViewModel から呼ばれる）
 * 【依存】`BrowserDataGateway`（fetch）
 * 【公開】`loadFromUrl`
 */

/**
 * Loader の返り値（ViewModel が状態反映するための最小構造）。
 * @typedef {{ layers: Array<{ geojson: any, name: string, sourceLabel: string, zoom?: boolean }>, messages: Array<{type: string, text: string}> }} LoadResult
 */

/**
 * 任意 URL から GeoJSON を fetch してレイヤ追加用の結果を返す。
 * @param {{ fetchGeoJson: (url: string) => Promise<any> }} dataSources
 * @param {string} url
 * @returns {Promise<LoadResult>}
 */
export async function loadFromUrl(dataSources, url) {
  const u = String(url ?? "").trim();
  if (!u) {
    return { layers: [], messages: [{ type: "warn", text: "URL が空です。" }] };
  }
  const geojson = await dataSources.fetchGeoJson(u);
  return {
    layers: [{ geojson, name: u, sourceLabel: "URL", zoom: true }],
    messages: [{ type: "success", text: "URL から読み込みました。" }],
  };
}

