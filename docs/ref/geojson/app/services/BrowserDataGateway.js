/**
 * 【役割】ブラウザ環境の I/O 境界（Gateway）。
 * - HTTP 取得（GeoJSON）
 * - ZIP 解凍（GeoJSON 抽出）
 *
 * 【レイヤ】Service（副作用あり）
 * 【依存】`fetch`・`JSZip`
 * 【公開】`BrowserDataGateway` クラス（= AppViewModel / Loaders が依存する「データ取得ポート」）
 * 【補足】
 * - ViewModel からは直接 `fetch` や `JSZip` を触らせない（保守性/差し替え容易性）。
 * - 入力検証と Zip Slip 対策（危険なエントリ名の拒否）はここで行う。
 */
function safeZipEntryName(name) {
  const n = String(name ?? "");
  if (!n) return null;
  if (n.includes("\0")) return null;
  if (n.startsWith("/") || n.startsWith("\\")) return null;
  if (n.includes("..")) return null;
  if (/^[a-zA-Z]:[\\/]/.test(n)) return null;
  return n.replaceAll("\\", "/");
}

function isGeoJsonLike(obj) {
  if (!obj || typeof obj !== "object") return false;
  const t = obj.type;
  return (
    t === "FeatureCollection" ||
    t === "Feature" ||
    t === "Point" ||
    t === "MultiPoint" ||
    t === "LineString" ||
    t === "MultiLineString" ||
    t === "Polygon" ||
    t === "MultiPolygon" ||
    t === "GeometryCollection"
  );
}

export class BrowserDataGateway {
  /**
   * 動作: ブラウザが提供する `fetch` と、CDN で読み込んだ `JSZip` を依存として受け取る。
   * @param {{fetchImpl: typeof fetch, jszip: any}} deps
   */
  constructor({ fetchImpl, jszip, apiClient = null }) {
    this.fetchImpl = fetchImpl;
    this.JSZip = jszip;
    this.apiClient = apiClient;
  }

  setApiClient(apiClient) { this.apiClient = apiClient; }

  getAuthState() { return this.apiClient?.getAuthState?.() ?? { authenticated: false, user: null }; }
  async login(email, password) {
    if (!this.apiClient) throw new Error("APIクライアントが初期化されていません。");
    return this.apiClient.login(email, password);
  }
  async logout() { return this.apiClient?.logout?.(); }
  async fetchGeoJsonByMesh(params) {
    if (!this.apiClient) throw new Error("APIクライアントが初期化されていません。");
    return this.apiClient.fetchGeoJsonByMesh(params);
  }
  async geocodeAddress(params) {
    if (!this.apiClient) throw new Error("APIクライアントが初期化されていません。");
    return this.apiClient.geocodeAddress(params);
  }

  /**
   * 動作: 指定 URL を fetch して JSON を読み取り、GeoJSON っぽい構造（type）かを検証して返す。
   * @param {string} url
   * @returns {Promise<any>}
   */
  async fetchGeoJson(url) {
    const res = await this.fetchImpl(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`取得に失敗しました: ${res.status}`);
    const json = await res.json();
    if (!isGeoJsonLike(json)) throw new Error("GeoJSON形式ではありません（type が見つかりません）。");
    return json;
  }

  /**
   * 動作: File（.geojson/.json）を読み取り、JSON パースして GeoJSON として返す。
   * @param {File} file
   * @returns {Promise<any>}
   */
  async readGeoJsonFromFile(file) {
    if (!file) throw new Error("ファイルが選択されていません。");
    const text = await file.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("JSONパースに失敗しました。");
    }
    if (!isGeoJsonLike(json)) throw new Error("GeoJSON形式ではありません（type が見つかりません）。");
    return json;
  }

  /**
   * 動作: ZIP を解凍し、含まれる `.geojson` / `.json` を抽出して GeoJSON 配列として返す。
   * - Zip Slip 対策: エントリ名の危険文字列を拒否
   * - JSON パース不能 / GeoJSON でないものはエラー or スキップ
   *
   * @param {File} file
   * @returns {Promise<Array<{name: string, geojson: any}>>}
   */
  async extractGeoJsonFromZip(file) {
    if (!file) throw new Error("ZIPファイルが選択されていません。");
    const name = file.name?.toLowerCase?.() ?? "";
    if (!name.endsWith(".zip")) throw new Error("ZIPファイル（.zip）を選択してください。");

    const buf = await file.arrayBuffer();
    let zip;
    try {
      zip = await this.JSZip.loadAsync(buf);
    } catch {
      throw new Error("ZIPの解凍に失敗しました（破損または未対応形式の可能性）。");
    }

    const entries = [];
    for (const [entryName, entry] of Object.entries(zip.files)) {
      if (!entry || entry.dir) continue;
      const safeName = safeZipEntryName(entryName);
      if (!safeName) continue;
      if (!safeName.toLowerCase().endsWith(".geojson") && !safeName.toLowerCase().endsWith(".json")) continue;
      entries.push({ safeName, entry });
    }

    if (!entries.length) throw new Error("ZIP内に .geojson / .json が見つかりません。");

    const out = [];
    for (const e of entries) {
      const text = await e.entry.async("text");
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`JSONパースに失敗しました: ${e.safeName}`);
      }
      if (!isGeoJsonLike(json)) {
        // skip but keep going
        continue;
      }
      out.push({ name: e.safeName, geojson: json });
    }

    if (!out.length) throw new Error("ZIP内に有効なGeoJSONが見つかりませんでした。");
    return out;
  }
}

