/**
 * 【役割】画面状態の唯一のソース。データ取得・レイヤ管理・フィルタ/色分けを提供し、状態変更を通知する。
 * 【レイヤ】ViewModel
 * 【依存】Model（`geoJsonHelpers`）・Service（`dataSources`）
 * 【公開】`AppViewModel` クラス（`initialize`/各種コマンドメソッド/`subscribe`/`getState`）
 * 【補足】DOM/Leaflet を import しない。地図操作は `mapIntent`（意図）として View に伝える。
 */
import { loadFromUrl } from "../loaders/urlLoader.js";
import { loadFromLocalFile } from "../loaders/localLoader.js";
import {
  applyFiltersToFeatureCollection,
  collectNestedPropertyKeysUnion,
  collectPropertyKeys,
  makeUnifiedCategoricalColorizer,
  randomId,
} from "../model/geoJsonHelpers.js";
import { normalizeToFeatureCollection } from "../model/geoJsonUtils.js";
import { meshBounds } from "../model/japanMesh.js";
import { GEOJSON_TYPES } from "../services/DevegokkoApiClient.js?v=20260917-2";

/**
 * MVVM の ViewModel: UI（DOM/地図）を知らず、状態とコマンドのみを持つ。
 * 変更は `#notify` 経由で購読者へ伝わる（View が購読して描画する）。
 */
export class AppViewModel extends EventTarget {
  static STATE_EVENT = "state";

  /**
   * 動作: 依存（データ取得サービス）を受け取り、タブ・レイヤ・通知などの初期状態フィールドを用意する。
   * 非同期の読み込みは行わない（`initialize` へ委譲）。
   * @param {{ dataSources: { fetchGeoJson: Function, extractGeoJsonFromZip: Function, readGeoJsonFromFile: Function } }} deps
   */
  constructor({ dataSources }) {
    super();
    this.dataSources = dataSources;

    this.activeTab = "local";

    /** @type {Array<{id: string, name: string, visible: boolean, featureCount: number, original: any, filtered: any, keys: string[], colorKey?: string|null, colorizer?: {key: string, colorForFeature: (f: any) => string} | null}>} */
    this.layers = [];

    this.loading = { active: false, text: "処理中..." };
    this.basemapEnabled = true;
    this.basemapType = "gsi-standard";
    this.mesh = { enabled: true, digits: 8, codes: [], activeCode: null, centerCode: null };
    this.webTile = { enabled: false, zoom: 0, tiles: [] };
    this.auth = this.dataSources.getAuthState?.() ?? { authenticated: false, user: null };

    /** @type {Array<{ type: string, text: string }>} */
    this.messages = [];

    this.selectedFeature = { title: "未選択", properties: {}, layerId: null, feature: null };

    // View に対する「一度だけ実行してほしい地図操作」の要求（＝状態ではなく意図）。
    /** @type {{ zoomToLayerId: string | null }} */
    this.mapIntent = { zoomToLayerId: null };

    /** @type {string[]} 現在読み込まれている全レイヤの属性パス和集合（ネストは `a.b` 形式／フィルタ・色分け UI 用） */
    this.attributeKeys = [];

    /** @type {string[]} 地図ラベルとして表示する属性キー（チェック済み） */
    this.labelCheckedKeys = [];
    /** @type {string[]} ラベル候補キーの表示順 */
    this.labelOrderKeys = [];
    /** @type {string[]} ラベル候補キー（ネスト展開済み） */
    this.labelCandidateKeys = [];
  }

  /**
   * 動作: View が `state` イベントを購読する。発火のたびに `fn` に現在の `getState()` スナップショットを渡す。
   * 戻り値: 購読解除用の関数（`removeEventListener`）。
   * @param {(state: ReturnType<AppViewModel["getState"]>) => void} fn
   */
  subscribe(fn) {
    const handler = () => fn(this.getState());
    this.addEventListener(AppViewModel.STATE_EVENT, handler);
    return () => this.removeEventListener(AppViewModel.STATE_EVENT, handler);
  }

  /**
   * 動作: View へ渡すための読み取り専用スナップショットを返す。
   * 配列・オブジェクトの一部は浅いコピー（messages / selectedFeature.properties / mapIntent / attributeKeys / label*）。
   * `layers` は参照のまま（大きい GeoJSON のコピー回避）。
   */
  getState() {
    return {
      activeTab: this.activeTab,
      layers: this.layers,
      loading: { ...this.loading },
      basemapEnabled: this.basemapEnabled,
      basemapType: this.basemapType,
      mesh: { ...this.mesh, codes: [...this.mesh.codes] },
      webTile: { ...this.webTile, tiles: [...this.webTile.tiles] },
      auth: { ...this.auth, user: this.auth.user ? { ...this.auth.user } : null },
      messages: this.messages.map((m) => ({ ...m })),
      selectedFeature: { ...this.selectedFeature, properties: { ...this.selectedFeature.properties } },
      mapIntent: { ...this.mapIntent },
      attributeKeys: [...this.attributeKeys],
      labelCheckedKeys: [...this.labelCheckedKeys],
      labelOrderKeys: [...this.labelOrderKeys],
      labelCandidateKeys: [...this.labelCandidateKeys],
    };
  }

  /**
   * 動作: 購読者へ「状態が変わった」と通知する（引数なしの `state` イベント）。
   */
  #notify() {
    this.dispatchEvent(new Event(AppViewModel.STATE_EVENT));
  }

  /**
   * 動作: 画面上部の通知リスト先頭にメッセージを追加し、最大 8 件で古いものを捨てる。
   */
  #pushMessage(type, text) {
    this.messages.unshift({ type, text });
    while (this.messages.length > 8) this.messages.pop();
  }

  /**
   * 動作: レイヤの追加・削除・一括読込後に呼ばれ、全レイヤの `original` から属性キー和集合を `attributeKeys` に反映する。
   * （旧名のまま: 以前はパネル用レイヤ ID の補正も行っていた）
   */
  #ensurePanelLayerIds() {
    this.#recomputeAttributeKeys();
  }

  /**
   * 動作: 現在読み込まれている全レイヤにまたがる properties キー一覧を再構築する。
   */
  #recomputeAttributeKeys() {
    const originals = this.layers.map((l) => l.original);
    const nested = collectNestedPropertyKeysUnion(originals);
    this.attributeKeys = nested;
    this.labelCandidateKeys = nested;
    this.#syncLabelKeysWithCandidates();
  }

  /**
   * 動作: 属性キー更新時にラベル候補（順序・チェック）を整合させる。
   * 既存の順序を優先し、消えたキーは除外し、新規キーは末尾に追加する。
   */
  #syncLabelKeysWithCandidates() {
    const allowed = new Set(this.labelCandidateKeys);

    const nextOrder = this.labelOrderKeys.filter((k) => allowed.has(k));
    for (const k of this.labelCandidateKeys) {
      if (!nextOrder.includes(k)) nextOrder.push(k);
    }

    this.labelOrderKeys = nextOrder;
    this.labelCheckedKeys = this.labelCheckedKeys.filter((k) => allowed.has(k));
  }

  /**
   * 動作: View が地図ズームを実行した後に呼び、`mapIntent.zoomToLayerId` をクリアして再描画する（意図の消費）。
   */
  clearMapZoomIntent() {
    this.mapIntent.zoomToLayerId = null;
    this.#notify();
  }

  /**
   * 動作: 地図ラベルのチェック状態と表示順をまとめて設定する。
   * @param {{ checkedKeys?: string[], orderKeys?: string[] }} payload
   */
  setLabelSelection(payload) {
    const allowed = new Set(this.labelCandidateKeys);

    const srcOrder = Array.isArray(payload?.orderKeys) ? payload.orderKeys : [];
    const nextOrder = srcOrder.filter((k) => allowed.has(k));
    for (const k of this.labelCandidateKeys) {
      if (!nextOrder.includes(k)) nextOrder.push(k);
    }

    const srcChecked = Array.isArray(payload?.checkedKeys) ? payload.checkedKeys : [];
    const nextChecked = [];
    for (const k of srcChecked) {
      if (allowed.has(k) && !nextChecked.includes(k)) nextChecked.push(k);
    }

    this.labelOrderKeys = nextOrder;
    this.labelCheckedKeys = nextChecked;
    this.#notify();
  }

  /**
   * 動作: 地図ラベルを解除する（チェックを空にする）。
   */
  clearLabel() {
    this.labelCheckedKeys = [];
    this.#notify();
  }

  reportMessage(type, text) {
    this.#pushMessage(type, text);
    this.#notify();
  }

  /**
   * 動作: 地図上のフィーチャがクリックされたとき。選択中フィーチャのタイトル文言と properties を状態に格納し通知する。
   */
  selectMapFeature(layerId, feature) {
    const layer = this.layers.find((l) => l.id === layerId);
    const fid = feature?.id ?? feature?.properties?.id ?? "(idなし)";
    this.selectedFeature = {
      title: layer ? `${layer.name} / Feature: ${String(fid)}` : `Feature: ${String(fid)}`,
      properties: feature?.properties ?? {},
      layerId: layerId ?? null,
      feature: feature ?? null,
    };
    this.#notify();
  }

  /**
   * 動作: データソース切替タブ（ローカル / URL / API）の表示状態を更新する。
   */
  setActiveTab(tabId) {
    this.activeTab = tabId || "local";
    this.#notify();
  }

  /**
   * 動作: ベースマップ（地理院タイル）の表示 ON/OFF を状態に反映する。View が地図アダプタへ反映する。
   */
  setBasemapEnabled(enabled) {
    this.basemapEnabled = !!enabled;
    this.#notify();
  }

  /**
   * 動作: 指定レイヤの表示フラグを更新する。地図同期は View 側の `syncGeoJsonLayers` が拾う。
   */
  setLayerVisible(layerId, visible) {
    const layer = this.layers.find((l) => l.id === layerId);
    if (!layer) return;
    layer.visible = !!visible;
    this.#notify();
  }

  /**
   * 動作: レイヤの並び順（=描画順）を 1 段上へ移動する。
   * `layers` 配列の後ろほど地図の上に描画される（View の `syncGeoJsonLayers` が順に addTo するため）。
   */
  moveLayerUp(layerId) {
    const idx = this.layers.findIndex((l) => l.id === layerId);
    if (idx < 0) return;
    if (idx === this.layers.length - 1) return; // already top
    const [it] = this.layers.splice(idx, 1);
    this.layers.splice(idx + 1, 0, it);
    this.#notify();
  }

  /**
   * 動作: レイヤの並び順（=描画順）を 1 段下へ移動する。
   */
  moveLayerDown(layerId) {
    const idx = this.layers.findIndex((l) => l.id === layerId);
    if (idx < 0) return;
    if (idx === 0) return; // already bottom
    const [it] = this.layers.splice(idx, 1);
    this.layers.splice(idx - 1, 0, it);
    this.#notify();
  }

  /**
   * 動作: レイヤ配列から該当レイヤを削除し、パネル選択 ID を整合させ、成功通知を出す。
   */
  removeLayer(layerId) {
    const idx = this.layers.findIndex((l) => l.id === layerId);
    if (idx < 0) return;
    this.layers.splice(idx, 1);
    this.#ensurePanelLayerIds();
    this.#pushMessage("success", "レイヤを削除しました。");
    this.#notify();
  }

  /**
   * 動作: 読み込み済みレイヤをすべて削除し、選択フィーチャと地図ズーム意図をリセットする。
   */
  clearAllLayers() {
    if (!this.layers.length) {
      this.#pushMessage("warn", "クリアするレイヤがありません。");
      this.#notify();
      return;
    }
    const n = this.layers.length;
    this.layers.length = 0;
    this.mapIntent.zoomToLayerId = null;
    this.selectedFeature = { title: "未選択", properties: {}, layerId: null, feature: null };
    this.#ensurePanelLayerIds();
    this.#pushMessage("success", `読み込みデータをクリアしました（${n} レイヤ）。`);
    this.#notify();
  }

  /**
   * 動作: レイヤ一覧の「ズーム」操作。View に「この layerId で fitBounds してほしい」と伝えるため `mapIntent` をセットする。
   */
  requestZoomToLayer(layerId) {
    this.mapIntent.zoomToLayerId = layerId;
    this.#notify();
  }

  /**
   * 動作: アプリ起動時にパネル選択を整え、起動完了メッセージを出す。
   */
  async initialize() {
    this.#ensurePanelLayerIds();
    this.#pushMessage("success", "2Dビューアを起動しました。GeoJSONを読み込んでください。");
    this.#notify();
  }

  setBasemapType(type) {
    const allowed = new Set(["gsi-standard", "gsi-pale", "osm"]);
    if (!allowed.has(type)) return;
    this.basemapType = type;
    this.#notify();
  }

  setMeshEnabled(enabled) { this.mesh.enabled = !!enabled; this.#notify(); }
  setWebTileEnabled(enabled) { this.webTile.enabled = !!enabled; this.#notify(); }
  setWebTileState(payload) { this.webTile = { ...this.webTile, ...payload, tiles: Array.isArray(payload?.tiles) ? [...payload.tiles] : this.webTile.tiles }; this.#notify(); }

  setMeshState(payload) {
    const nextCodes = Array.isArray(payload?.codes) ? [...payload.codes] : this.mesh.codes;
    this.mesh = {
      ...this.mesh,
      ...payload,
      activeCode: nextCodes.includes(this.mesh.activeCode) ? this.mesh.activeCode : null,
      codes: nextCodes,
    };
    this.#notify();
  }

  selectMesh(meshCode) {
    const code = String(meshCode ?? "");
    if (!this.mesh.codes.includes(code)) return;
    this.mesh.activeCode = this.mesh.activeCode === code ? null : code;
    this.#pushMessage("success", this.mesh.activeCode ? `地域メッシュ ${code} を選択しました。` : "地域メッシュの選択を解除しました。");
    this.#notify();
  }

  async login(email, password) {
    const id = String(email ?? "").trim();
    if (!id || !String(password ?? "")) {
      this.#pushMessage("warn", "IDとパスワードを入力してください。");
      this.#notify();
      return;
    }
    this.loading = { active: true, text: "ログインしています..." };
    this.#notify();
    try {
      this.auth = await this.dataSources.login(id, password);
      this.#pushMessage("success", `ログインしました${this.auth.user?.email ? `（${this.auth.user.email}）` : ""}。`);
    } catch (e) {
      this.auth = { authenticated: false, user: null };
      this.#pushMessage("error", e?.message ?? String(e));
    } finally {
      this.loading = { active: false, text: "処理中..." };
      this.#notify();
    }
  }

  async logout() {
    try {
      await this.dataSources.logout?.();
      this.auth = { authenticated: false, user: null };
      this.#pushMessage("success", "ログアウトしました。");
    } catch (e) {
      this.#pushMessage("error", e?.message ?? String(e));
    }
    this.#notify();
  }

  async loadSelectedMesh({ types = GEOJSON_TYPES } = {}) {
    const code = this.mesh.activeCode;
    if (!code) {
      this.#pushMessage("warn", "地図上の地域メッシュを選択してください。");
      this.#notify();
      return;
    }
    this.loading = { active: true, text: `地域メッシュ ${code} を取得しています...` };
    this.#notify();
    try {
      const geojson = await this.dataSources.fetchGeoJsonByMesh({ meshCode: code, bounds: meshBounds(code), types });
      await this.#addLayerFromGeoJson(geojson, { name: `地域メッシュ ${code}`, sourceLabel: "API", zoom: true });
      this.#pushMessage("success", `地域メッシュ ${code} のGeoJSONを取得しました（${geojson.features?.length ?? 0} フィーチャ）。`);
    } catch (e) {
      this.#pushMessage("error", e?.message ?? String(e));
    } finally {
      this.loading = { active: false, text: "処理中..." };
      this.#notify();
    }
  }

  async searchAddress({ address } = {}) {
    this.loading = { active: true, text: "住所を検索しています..." };
    this.#notify();
    try {
      const geojson = await this.dataSources.geocodeAddress({ address });
      await this.#addLayerFromGeoJson(geojson, { name: `住所: ${String(address ?? "").trim()}`, sourceLabel: "住所API", zoom: true });
      this.#pushMessage("success", `住所を検索しました（${geojson.features?.length ?? 0} 件）。`);
    } catch (e) {
      this.#pushMessage("error", e?.message ?? String(e));
    } finally {
      this.loading = { active: false, text: "処理中..." };
      this.#notify();
    }
  }

  /**
   * 動作: 任意 URL から GeoJSON を取得してレイヤ化する（出典ラベルは「URL」）。
   */
  async loadUrl(url) {
    this.loading = { active: true, text: "URL から取得しています..." };
    this.#notify();
    try {
      const result = await loadFromUrl(this.dataSources, url);
      await this.#applyLoadResult(result);
    } catch (e) {
      this.#pushMessage("error", e?.message ?? String(e));
    } finally {
      this.loading = { active: false, text: "処理中..." };
      this.#ensurePanelLayerIds();
      this.#notify();
    }
  }

  /**
   * 動作: ローカルファイル（.zip/.geojson/.json）を読み込み、含まれる GeoJSON をすべてレイヤとして追加する。
   */
  async loadLocal(file) {
    this.loading = { active: true, text: "ローカルファイルを読み込んでいます..." };
    this.#notify();
    try {
      const result = await loadFromLocalFile(this.dataSources, file);
      await this.#applyLoadResult(result);
    } catch (e) {
      this.#pushMessage("error", e?.message ?? String(e));
    } finally {
      this.loading = { active: false, text: "処理中..." };
      this.#ensurePanelLayerIds();
      this.#notify();
    }
  }

  /**
   * Loader が返した結果（追加レイヤ + メッセージ）を状態へ反映する。
   * @param {{ layers?: Array<{ geojson: any, name: string, sourceLabel: string, zoom?: boolean }>, messages?: Array<{type: string, text: string}> }} result
   */
  async #applyLoadResult(result) {
    for (const l of result?.layers ?? []) {
      await this.#addLayerFromGeoJson(l.geojson, { name: l.name, sourceLabel: l.sourceLabel, zoom: l.zoom ?? true });
    }
    for (const m of result?.messages ?? []) {
      this.#pushMessage(m.type, m.text);
    }
  }

  /**
   * 動作: 生 GeoJSON を FeatureCollection 化し、新レイヤオブジェクトを `layers` 先頭に追加する。
   * 属性キー一覧を保持し、選択フィーチャをリセット。`zoom` が true なら View へズーム意図を渡す。
   * @param {boolean} [opts.zoom]
   */
  async #addLayerFromGeoJson(rawGeojson, { name, sourceLabel, zoom = true }) {
    const fc = normalizeToFeatureCollection(rawGeojson);
    const id = randomId("layer");
    const keys = collectPropertyKeys(fc);

    const layer = {
      id,
      name: `${name} (${sourceLabel})`,
      visible: true,
      featureCount: fc.features?.length ?? 0,
      original: fc,
      filtered: fc,
      keys,
      colorKey: null,
      colorizer: null,
    };
    this.layers.unshift(layer);

    this.selectedFeature = { title: "未選択", properties: {}, layerId: null, feature: null };
    if (zoom) this.mapIntent.zoomToLayerId = id;
    this.#ensurePanelLayerIds();
    this.#notify();
  }

  /**
   * 動作: 読み込み済みの全レイヤそれぞれの `original` に同じ属性条件（複数可・AND）でフィルタし、`filtered` と件数を更新する。
   * @param {{ criteria?: Array<{ key?: string, value?: string, exact?: boolean }> }} payload
   */
  applyFilter({ criteria }) {
    if (!this.layers.length) {
      this.#pushMessage("warn", "レイヤがありません。先にデータを読み込んでください。");
      this.#notify();
      return;
    }

    const active = (criteria ?? [])
      .map((c) => ({
        key: String(c?.key ?? "").trim(),
        value: String(c?.value ?? ""),
        exact: !!c?.exact,
      }))
      .filter((c) => c.key && c.value);

    if (!active.length) {
      this.#pushMessage("warn", "有効なフィルタ条件がありません（属性キーと値を入力してください）。");
      this.#notify();
      return;
    }

    let total = 0;
    for (const layer of this.layers) {
      const filtered = applyFiltersToFeatureCollection(layer.original, active);
      layer.filtered = filtered;
      layer.featureCount = filtered.features?.length ?? 0;
      total += layer.featureCount;
    }
    this.#pushMessage(
      "success",
      `フィルタを全 ${this.layers.length} レイヤに適用しました（条件 ${active.length} 件・合計 ${total} フィーチャ表示）。`,
    );
    this.#notify();
  }

  /**
   * 動作: 全レイヤの表示データをそれぞれの `original` に戻し、件数を復元する。
   */
  clearFilter() {
    if (!this.layers.length) return;
    for (const layer of this.layers) {
      layer.filtered = layer.original;
      layer.featureCount = layer.original.features?.length ?? 0;
    }
    this.#pushMessage("success", "全レイヤのフィルタを解除しました。");
    this.#notify();
  }

  /**
   * 動作: 全レイヤの `original` を走査して属性値と色の対応を一括決定し、各レイヤに同じ `colorizer` を割り当てる（値ごとの色はレイヤをまたいで一致）。
   */
  applyColor({ key }) {
    if (!this.layers.length) {
      this.#pushMessage("warn", "レイヤがありません。先にデータを読み込んでください。");
      this.#notify();
      return;
    }
    if (!key) {
      this.#pushMessage("warn", "属性キーを選択してください。");
      this.#notify();
      return;
    }
    const originals = this.layers.map((l) => l.original);
    const colorizer = makeUnifiedCategoricalColorizer(originals, key);
    for (const layer of this.layers) {
      layer.colorKey = key;
      layer.colorizer = colorizer;
    }
    this.#pushMessage("success", `色分けを全 ${this.layers.length} レイヤに適用しました（キー: ${key}）。`);
    this.#notify();
  }

  /**
   * 動作: 全レイヤの色分け設定（`colorKey` / `colorizer`）を解除する。
   */
  clearColor() {
    if (!this.layers.length) return;
    for (const layer of this.layers) {
      layer.colorKey = null;
      layer.colorizer = null;
    }
    this.#pushMessage("success", "全レイヤの色分けを解除しました。");
    this.#notify();
  }
}
