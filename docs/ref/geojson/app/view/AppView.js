/**
 * 【役割】DOM と地図（Leaflet）へ状態を反映し、ユーザー操作を Command に委譲する。
 * 【レイヤ】View
 * 【依存】`AppViewModel`（購読）・`LeafletMapAdapter`（地図）・`appCommands`（dispatch）・`mapGeoJsonSync`
 * 【公開】`AppView` クラス
 * 【補足】View は「描画」と「イベント入口」だけを担当し、業務ロジックは持たない。
 */
import { syncGeoJsonLayers } from "./mapGeoJsonSync.js?v=20260917-2";
import { syncMeshLayer, syncWebTileLayer } from "./meshSync.js?v=20260917-2";
import { dispatch } from "../command/appCommands.js?v=20260917-2";

/** レイヤ一覧の表示名の最大文字数（超過分は「…」に置き換え。全文は `title` で表示）。 */
const LAYER_NAME_DISPLAY_MAX_CHARS = 40;
const LABEL_VIEWPORT_SYNC_DEBOUNCE_MS = 140;
const LABEL_MAX_COUNT = 1800;

/**
 * @param {string} full
 */
function formatLayerNameForList(full) {
  const s = String(full ?? "");
  if (s.length <= LAYER_NAME_DISPLAY_MAX_CHARS) return s;
  return `${s.slice(0, LAYER_NAME_DISPLAY_MAX_CHARS - 1)}…`;
}

/**
 * MVVM+Command の View: ViewModel を購読し、状態を DOM / 地図へ反映する。ユーザー操作は Command へ委譲する。
 */
export class AppView {
  /**
   * 動作: 必須 DOM ノードを取得し、タブ・読み込み・フィルタ等の参照を保持する。
   * `#wireCommands` でイベントを Command に結線し、`vm.subscribe` で状態変更のたびに `#syncFromState` を呼ぶ。
   * 構築完了時に初回同期を実行する。
   * @param {Document} doc
   * @param {import("../viewmodel/AppViewModel.js").AppViewModel} viewModel
   * @param {import("../services/LeafletMapAdapter.js").LeafletMapAdapter} mapAdapter
   * @param {Record<string, (payload:any)=>any>} commands
   */
  constructor(doc, viewModel, mapAdapter, commands) {
    this.doc = doc;
    this.vm = viewModel;
    this.map = mapAdapter;
    this.commands = commands;

    this.statusText = this.#must("statusText");
    this.notifications = this.#must("notifications");
    this.loadingOverlay = this.#must("loadingOverlay");
    this.loadingText = this.#must("loadingText");

    this.layerList = this.#must("layerList");
    this.layerSummary = this.#must("layerSummary");
    this.basemapCheck = this.#must("basemapCheck");

    this.meshCheck = this.#must("meshCheck");
    this.webTileCheck = this.#must("webTileCheck");

    this.urlInput = this.#must("urlInput");
    this.loadUrlBtn = this.#must("loadUrlBtn");


    this.loginIdInput = this.#must("loginIdInput");
    this.loginPasswordInput = this.#must("loginPasswordInput");
    this.loginBtn = this.#must("loginBtn");
    this.logoutBtn = this.#must("logoutBtn");
    this.addressInput = this.#must("addressInput");
    this.searchAddressBtn = this.#must("searchAddressBtn");
    this.meshTypeInputs = Array.from(this.doc.querySelectorAll("[data-mesh-type]"));
    this.meshSelectionStatus = this.#must("meshSelectionStatus");
    this.loadMeshBtn = this.#must("loadMeshBtn");

    this.zipInput = this.#must("zipInput");
    this.loadZipBtn = this.#must("loadZipBtn");
    this.clearLoadedDataBtn = this.#must("clearLoadedDataBtn");

    this.filterCriteriaList = this.#must("filterCriteriaList");
    this.addFilterCriterionBtn = this.#must("addFilterCriterionBtn");
    this.applyFilterBtn = this.#must("applyFilterBtn");
    this.clearFilterBtn = this.#must("clearFilterBtn");
    /** @type {string[]} フィルタ条件 UI 用の属性キー一覧 */
    this.filterAttributeKeys = [];
    /** @type {Array<{ key: string, value: string, exact: boolean }>} 未適用のフィルタ条件 */
    this.filterDraftCriteria = [{ key: "", value: "", exact: false }];

    this.colorKeySelect = this.#must("colorKeySelect");
    this.applyColorBtn = this.#must("applyColorBtn");
    this.clearColorBtn = this.#must("clearColorBtn");

    this.selectedMeta = this.#must("selectedMeta");
    this.propTable = this.#must("propTable");

    this.labelKeyList = this.#must("labelKeyList");
    this.applyLabelBtn = this.#must("applyLabelBtn");
    this.clearLabelBtn = this.#must("clearLabelBtn");

    /** @type {string[]} ラベル設定UI（未適用）の並び順 */
    this.labelDraftOrder = [];
    /** @type {Set<string>} ラベル設定UI（未適用）のチェック状態 */
    this.labelDraftChecked = new Set();
    this.labelDraftStateSig = "";

    this.tabs = Array.from(doc.querySelectorAll(".tab"));
    this.tabpanes = Array.from(doc.querySelectorAll(".tabpane"));

    this.labelViewportTimer = null;
    this.unsubscribeViewport = this.map.onViewportChanged(() => {
      this.#scheduleViewportLabelSync();
      dispatch(this.commands, "setMeshState", this.map.getMeshViewportState());
      dispatch(this.commands, "setWebTileState", this.map.getWebTileViewportState());
    });

    this.#wireCommands();
    this.unsubscribe = this.vm.subscribe(() => this.#syncFromState());
    this.#syncFromState();
  }

  /**
   * 動作: `getElementById` で要素を取得し、なければ起動失敗とする（必須 UI の存在保証）。
   */
  #must(id) {
    const el = this.doc.getElementById(id);
    if (!el) throw new Error(`必須要素が見つかりません: #${id}`);
    return el;
  }

  /**
   * 動作: ボタン・タブ・チェックボックス等のクリック／変更を `dispatch(commands, name, payload)` に接続する。
   * ViewModel を直接呼ばず、必ず Command 経由にする。
   */
  #wireCommands() {
    for (const tab of this.tabs) {
      tab.addEventListener("click", () =>
        dispatch(this.commands, "setActiveTab", tab.dataset.tab));
    }

    this.meshCheck.addEventListener("change", () => dispatch(this.commands, "setMeshEnabled", this.meshCheck.checked));
    this.webTileCheck.addEventListener("change", () => dispatch(this.commands, "setWebTileEnabled", this.webTileCheck.checked));
    this.loadUrlBtn.addEventListener("click", () => 
      dispatch(this.commands, "loadUrl", this.urlInput.value));
    this.loginBtn.addEventListener("click", () => dispatch(this.commands, "login", {
      email: this.loginIdInput.value,
      password: this.loginPasswordInput.value,
    }));
    this.loginPasswordInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") this.loginBtn.click();
    });
    this.logoutBtn.addEventListener("click", () => dispatch(this.commands, "logout"));
    this.searchAddressBtn.addEventListener("click", () => dispatch(this.commands, "searchAddress", {
      address: this.addressInput.value,
    }));
    this.addressInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") this.searchAddressBtn.click();
    });
    this.loadMeshBtn.addEventListener("click", () => dispatch(this.commands, "loadSelectedMesh", {
      types: this.meshTypeInputs.filter((input) => input.checked).map((input) => input.dataset.meshType),
    }));
    this.loadZipBtn.addEventListener("click", () => 
      dispatch(this.commands, "loadLocal", this.zipInput.files?.[0] ?? null));
    this.clearLoadedDataBtn.addEventListener("click", () => dispatch(this.commands, "clearLoadedData"));

    this.basemapCheck.addEventListener("change", () =>
      dispatch(this.commands, "setBasemapEnabled", this.basemapCheck.checked),
    );

    this.addFilterCriterionBtn.addEventListener("click", () => {
      this.#syncFilterDraftFromDom();
      this.filterDraftCriteria.push({ key: "", value: "", exact: false });
      this.#renderFilterCriteriaList();
    });
    this.applyFilterBtn.addEventListener("click", () => {
      this.#syncFilterDraftFromDom();
      dispatch(this.commands, "applyFilter", { criteria: this.filterDraftCriteria });
    });
    this.clearFilterBtn.addEventListener("click", () => {
      this.filterDraftCriteria = [{ key: "", value: "", exact: false }];
      this.#renderFilterCriteriaList();
      dispatch(this.commands, "clearFilter");
    });

    this.applyColorBtn.addEventListener("click", () =>
      dispatch(this.commands, "applyColor", {
        key: this.colorKeySelect.value,
      }),
    );
    this.clearColorBtn.addEventListener("click", () => dispatch(this.commands, "clearColor"));

    this.applyLabelBtn.addEventListener("click", () =>
      dispatch(this.commands, "setLabelSelection", {
        checkedKeys: [...this.labelDraftChecked],
        orderKeys: [...this.labelDraftOrder],
      }),
    );
    this.clearLabelBtn.addEventListener("click", () => dispatch(this.commands, "clearLabel"));
  }

  /**
   * 動作: `getState()` のスナップショットを DOM と地図へ一括反映する（購読コールバックの本体）。
   * タブ・静的一覧・ローディング・通知・レイヤ一覧・フィルタ UI・選択フィーチャを更新し、
   * `syncGeoJsonLayers` で GeoJSON レイヤを差分同期。`mapIntent` にズーム要求があればマイクロタスクで実行後クリアする。
   */
  #syncFromState() {
    const s = this.vm.getState();

    this.setActiveTab(s.activeTab);
    this.setLoading(s.loading.active, s.loading.text);

    this.basemapCheck.checked = s.basemapEnabled;
    this.map.setBasemapEnabled(s.basemapEnabled);
    this.meshCheck.checked = s.mesh.enabled;
    syncMeshLayer(this.map, s.mesh, (meshCode) => dispatch(this.commands, "selectMesh", meshCode));
    this.#syncAuthControls(s.auth, s.mesh);
    this.webTileCheck.checked = s.webTile.enabled;
    syncWebTileLayer(this.map, s.webTile);

    this.#renderMessages(s.messages);

    this.#renderLayers(s.layers);

    this.#setAttributeKeyOptions(s.attributeKeys);
    this.#syncLabelDraftFromState(s);
    this.#renderLabelKeyList();
    this.setSelectedFeature(s.selectedFeature.title, s.selectedFeature.properties);

    syncGeoJsonLayers(this.map, s.layers, {
      onFeatureClick: (layerId, feature) => 
        dispatch(this.commands, "selectMapFeature", { layerId, feature }),
      labelKeys: s.labelOrderKeys.filter((k) => s.labelCheckedKeys.includes(k)),
      selectedFeature: s.selectedFeature.feature ?? null,
    });

    // 選択中フィーチャのハイライトを地図に反映する
    const sf = s.selectedFeature;
    if (sf.layerId && sf.feature) {
      this.map.highlightFeature(sf.layerId, sf.feature);
    } else {
      this.map.clearHighlight();
    }

    if (s.mapIntent.zoomToLayerId) {
      const zoomId = s.mapIntent.zoomToLayerId;
      queueMicrotask(() => {
        this.map.zoomToLayer(zoomId);
        dispatch(this.commands, "clearMapZoomIntent");
      });
    }
  }

  #syncAuthControls(auth, mesh) {
    const loggedIn = !!auth?.authenticated;
    this.loginBtn.disabled = loggedIn;
    this.logoutBtn.disabled = !loggedIn;
    this.loginIdInput.disabled = loggedIn;
    this.loginPasswordInput.disabled = loggedIn;
    this.loadMeshBtn.disabled = !loggedIn || !mesh?.activeCode;
    this.meshSelectionStatus.textContent = mesh?.activeCode ? `選択中: ${mesh.activeCode}` : "未選択（地図上のメッシュをクリック）";
    this.statusText.textContent = loggedIn
      ? `ログイン中${auth.user?.email ? `: ${auth.user.email}` : ""}`
      : "未ログイン";
  }

  /**
   * 動作: 通知領域を空にし、ViewModel のメッセージ配列を新しい順で DOM ノード化して積む（先頭が最新）。
   */
  #renderMessages(messages) {
    this.notifications.innerHTML = "";
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      const div = this.doc.createElement("div");
      div.className = `notice notice--${m.type}`;
      div.textContent = m.text;
      this.notifications.prepend(div);
    }
  }

  /**
   * 動作: データソースタブの見た目（`.is-active`）を `tabId` に合わせて切り替える。
   */
  setActiveTab(tabId) {
    for (const tab of this.tabs) tab.classList.toggle("is-active", tab.dataset.tab === tabId);
    for (const pane of this.tabpanes) pane.classList.toggle("is-active", pane.dataset.pane === tabId);
  }

  /**
   * 動作: 全画面ローディングオーバーレイの表示／非表示と文言を更新する。
   */
  setLoading(isLoading, text = "処理中...") {
    this.loadingText.textContent = text;
    this.loadingOverlay.classList.toggle("is-hidden", !isLoading);
    this.loadingOverlay.setAttribute("aria-hidden", String(!isLoading));
  }

  /**
   * 動作: レイヤ一覧 `<ul>` を再描画する。各項目に表示チェック（Command へ）、ズーム・削除ボタンを付与し、サマリ文言を更新する。
   */
  #renderLayers(layers) {
    this.layerList.innerHTML = "";
    const total = layers.reduce((acc, l) => acc + (l.featureCount ?? 0), 0);
    this.layerSummary.textContent = `${layers.length} レイヤ / ${total} フィーチャ`;

    // UIは「前面（地図で上）を上、後面（地図で下）を下」で表示する。
    // 地図側は `layers` 配列の後ろほど上に描画されるため、ここでは逆順に並べる。
    const uiLayers = [...layers].reverse();
    for (let i = 0; i < uiLayers.length; i++) {
      const layer = uiLayers[i];
      const li = this.doc.createElement("li");
      li.className = "layerItem";

      const checkbox = this.doc.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = !!layer.visible;
      checkbox.addEventListener("change", () =>
        dispatch(this.commands, "setLayerVisible", { layerId: layer.id, visible: checkbox.checked }),
      );

      const text = this.doc.createElement("div");
      text.className = "layerItem__text";
      const name = this.doc.createElement("div");
      name.className = "layerItem__name";
      name.textContent = formatLayerNameForList(layer.name);
      name.title = layer.name;
      const meta = this.doc.createElement("div");
      meta.className = "layerItem__meta";
      meta.textContent = `${layer.featureCount} 件`;
      text.append(name, meta);

      const actions = this.doc.createElement("div");
      actions.className = "layerItem__actions";

      const downBtn = this.doc.createElement("button");
      downBtn.className = "iconBtn";
      downBtn.type = "button";
      downBtn.title = "下へ（背面へ）";
      downBtn.textContent = "▼";
      downBtn.disabled = i === uiLayers.length - 1; // bottom is backmost
      downBtn.addEventListener("click", () => dispatch(this.commands, "moveLayerDown", layer.id));

      const upBtn = this.doc.createElement("button");
      upBtn.className = "iconBtn";
      upBtn.type = "button";
      upBtn.title = "上へ（前面へ）";
      upBtn.textContent = "▲";
      upBtn.disabled = i === 0; // top is frontmost
      upBtn.addEventListener("click", () => dispatch(this.commands, "moveLayerUp", layer.id));

      const zoomBtn = this.doc.createElement("button");
      zoomBtn.className = "iconBtn";
      zoomBtn.type = "button";
      zoomBtn.title = "ズーム";
      zoomBtn.textContent = "🔎";
      zoomBtn.addEventListener("click", () => 
        dispatch(this.commands, "requestZoomToLayer", layer.id));

      const delBtn = this.doc.createElement("button");
      delBtn.className = "iconBtn iconBtn--danger";
      delBtn.type = "button";
      delBtn.title = "削除";
      delBtn.textContent = "🗑";
      delBtn.addEventListener("click", () => 
        dispatch(this.commands, "removeLayer", layer.id));

      actions.append(downBtn, upBtn, zoomBtn, delBtn);
      li.append(checkbox, text, actions);
      this.layerList.appendChild(li);
    }
  }

  /**
   * 動作: 属性キー一覧を更新し、色分け用 `<select>` とフィルタ条件行を再構築する。
   */
  #setAttributeKeyOptions(keys) {
    const prevColor = this.colorKeySelect.value;
    this.filterAttributeKeys = [...keys];
    this.colorKeySelect.innerHTML = "";
    this.#fillAttributeKeySelect(this.colorKeySelect, keys, "");
    if (keys.includes(prevColor)) this.colorKeySelect.value = prevColor;
    this.#syncFilterDraftFromDom();
    this.#renderFilterCriteriaList();
  }

  /**
   * @param {HTMLSelectElement} selectEl
   * @param {string[]} keys
   * @param {string} selectedValue
   */
  #fillAttributeKeySelect(selectEl, keys, selectedValue) {
    selectEl.innerHTML = "";
    if (!keys.length) {
      const opt = this.doc.createElement("option");
      opt.value = "";
      opt.textContent = "（属性キーがありません）";
      selectEl.appendChild(opt);
      selectEl.disabled = true;
      return;
    }
    selectEl.disabled = false;

    const placeholder = this.doc.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "— 選択 —";
    selectEl.appendChild(placeholder);

    const anyNested = keys.some((k) => k.includes("."));
    if (!anyNested) {
      for (const k of keys) {
        const opt = this.doc.createElement("option");
        opt.value = k;
        opt.textContent = k;
        selectEl.appendChild(opt);
      }
    } else {
      /** @type {Map<string, string[]>} */
      const byPrefix = new Map();
      for (const k of keys) {
        const dot = k.indexOf(".");
        const prefix = dot === -1 ? "" : k.slice(0, dot);
        if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
        byPrefix.get(prefix).push(k);
      }
      for (const arr of byPrefix.values()) {
        arr.sort((a, b) => a.localeCompare(b, "ja"));
      }
      const prefixes = [...byPrefix.keys()].sort((a, b) => {
        if (a === "") return -1;
        if (b === "") return 1;
        return a.localeCompare(b, "ja");
      });
      for (const prefix of prefixes) {
        const list = byPrefix.get(prefix) ?? [];
        const og = this.doc.createElement("optgroup");
        og.label = prefix === "" ? "（トップ）" : prefix;
        for (const k of list) {
          const opt = this.doc.createElement("option");
          opt.value = k;
          opt.textContent = k;
          og.appendChild(opt);
        }
        selectEl.appendChild(og);
      }
    }

    if (selectedValue && keys.includes(selectedValue)) {
      selectEl.value = selectedValue;
    }
  }

  #syncFilterDraftFromDom() {
    const rows = this.filterCriteriaList.querySelectorAll("[data-filter-row]");
    if (!rows.length) return;
    this.filterDraftCriteria = Array.from(rows).map((row) => ({
      key: row.querySelector(".filterCriterion__key")?.value ?? "",
      value: row.querySelector(".filterCriterion__value")?.value ?? "",
      exact: row.querySelector(".filterCriterion__exact")?.checked ?? false,
    }));
  }

  #renderFilterCriteriaList() {
    const keys = this.filterAttributeKeys;
    if (!this.filterDraftCriteria.length) {
      this.filterDraftCriteria = [{ key: "", value: "", exact: false }];
    }

    this.filterCriteriaList.innerHTML = "";

    if (!keys.length) {
      const li = this.doc.createElement("li");
      li.className = "filterCriterion filterCriterion--empty";
      li.textContent = "（データを読み込むと属性キーが選べます）";
      this.filterCriteriaList.appendChild(li);
      return;
    }

    for (let i = 0; i < this.filterDraftCriteria.length; i++) {
      const c = this.filterDraftCriteria[i];
      const li = this.doc.createElement("li");
      li.className = "filterCriterion";
      li.dataset.filterRow = "1";

      const head = this.doc.createElement(String.fromCharCode(100, 105, 118));
      head.className = "filterCriterion__head";
      const index = this.doc.createElement("span");
      index.className = "filterCriterion__index";
      index.textContent = `条件 ${i + 1}`;
      const removeBtn = this.doc.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "iconBtn iconBtn--danger";
      removeBtn.title = "この条件を削除";
      removeBtn.textContent = "🗑";
      removeBtn.disabled = this.filterDraftCriteria.length <= 1;
      removeBtn.addEventListener("click", () => {
        this.#syncFilterDraftFromDom();
        if (this.filterDraftCriteria.length <= 1) return;
        this.filterDraftCriteria.splice(i, 1);
        this.#renderFilterCriteriaList();
      });
      head.append(index, removeBtn);

      const fields = this.doc.createElement("div");
      fields.className = "filterCriterion__fields";

      const keyRow = this.doc.createElement("div");
      keyRow.className = "filterCriterion__row";
      const keyLabel = this.doc.createElement("label");
      keyLabel.textContent = "属性キー";
      const keySelect = this.doc.createElement("select");
      keySelect.className = "filterCriterion__key field__control";
      this.#fillAttributeKeySelect(keySelect, keys, c.key);
      keyRow.append(keyLabel, keySelect);

      const valueRow = this.doc.createElement("div");
      valueRow.className = "filterCriterion__row";
      const valueLabel = this.doc.createElement("label");
      valueLabel.textContent = "値";
      const valueInput = this.doc.createElement("input");
      valueInput.type = "text";
      valueInput.className = "filterCriterion__value field__control";
      valueInput.placeholder = "検索文字列";
      valueInput.value = c.value;
      valueRow.append(valueLabel, valueInput);

      const exactLabel = this.doc.createElement("label");
      exactLabel.className = "check";
      const exactCheck = this.doc.createElement("input");
      exactCheck.type = "checkbox";
      exactCheck.className = "filterCriterion__exact";
      exactCheck.checked = c.exact;
      const exactSpan = this.doc.createElement("span");
      exactSpan.textContent = "完全一致";
      exactLabel.append(exactCheck, exactSpan);

      fields.append(keyRow, valueRow, exactLabel);
      li.append(head, fields);
      this.filterCriteriaList.appendChild(li);
    }
  }

  #syncLabelDraftFromState(s) {
    const nextSig = `${s.labelCandidateKeys.join("\u0001")}||${s.labelOrderKeys.join("\u0001")}||${s.labelCheckedKeys.join("\u0001")}`;
    if (nextSig === this.labelDraftStateSig) return;

    this.labelDraftStateSig = nextSig;
    this.labelDraftOrder = [...s.labelOrderKeys];
    this.labelDraftChecked = new Set(s.labelCheckedKeys);
  }

  #moveLabelDraft(orderIndex, delta) {
    const to = orderIndex + delta;
    if (to < 0 || to >= this.labelDraftOrder.length) return;
    const [it] = this.labelDraftOrder.splice(orderIndex, 1);
    this.labelDraftOrder.splice(to, 0, it);
    this.#renderLabelKeyList();
  }

  #renderLabelKeyList() {
    this.labelKeyList.innerHTML = "";

    if (!this.labelDraftOrder.length) {
      const li = this.doc.createElement("li");
      li.className = "labelKeyItem labelKeyItem--empty";
      li.textContent = "（属性キーがありません）";
      this.labelKeyList.appendChild(li);
      return;
    }

    for (let i = 0; i < this.labelDraftOrder.length; i++) {
      const keyName = this.labelDraftOrder[i];
      const li = this.doc.createElement("li");
      li.className = "labelKeyItem";

      const checkbox = this.doc.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = this.labelDraftChecked.has(keyName);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) this.labelDraftChecked.add(keyName);
        else this.labelDraftChecked.delete(keyName);
      });

      const text = this.doc.createElement("div");
      text.className = "labelKeyItem__text";
      const name = this.doc.createElement("div");
      name.className = "labelKeyItem__name";
      name.textContent = keyName;
      const meta = this.doc.createElement("div");
      meta.className = "labelKeyItem__meta";
      meta.textContent = this.labelDraftChecked.has(keyName) ? "表示対象" : "未選択";
      text.append(name, meta);

      const actions = this.doc.createElement("div");
      actions.className = "labelKeyItem__actions";

      const downBtn = this.doc.createElement("button");
      downBtn.className = "iconBtn";
      downBtn.type = "button";
      downBtn.title = "下へ";
      downBtn.textContent = "▼";
      downBtn.disabled = i === this.labelDraftOrder.length - 1;
      downBtn.addEventListener("click", () => this.#moveLabelDraft(i, +1));

      const upBtn = this.doc.createElement("button");
      upBtn.className = "iconBtn";
      upBtn.type = "button";
      upBtn.title = "上へ";
      upBtn.textContent = "▲";
      upBtn.disabled = i === 0;
      upBtn.addEventListener("click", () => this.#moveLabelDraft(i, -1));

      actions.append(upBtn, downBtn);
      li.append(checkbox, text, actions);
      this.labelKeyList.appendChild(li);
    }
  }

  #scheduleViewportLabelSync() {
    if (this.labelViewportTimer != null) clearTimeout(this.labelViewportTimer);
    this.labelViewportTimer = setTimeout(() => {
      this.labelViewportTimer = null;
      this.#syncViewportLabelsFromState(this.vm.getState());
    }, LABEL_VIEWPORT_SYNC_DEBOUNCE_MS);
  }

  #syncViewportLabelsFromState(s) {
    const activeLabelKeys = s.labelOrderKeys.filter((k) => s.labelCheckedKeys.includes(k));
    this.map.syncViewportLabels({
      layerIds: s.layers.map((l) => l.id),
      labelKeys: activeLabelKeys,
      maxLabels: LABEL_MAX_COUNT,
      selectedFeature: s.selectedFeature.feature ?? null,
    });
  }

  /**
   * 動作: 地図クリックで選ばれたフィーチャのタイトルと properties をサイドパネルに表形式で表示する。
   */
  setSelectedFeature(metaText, properties) {
    this.selectedMeta.textContent = metaText;
    this.propTable.innerHTML = "";

    if (!properties || typeof properties !== "object") return;
    const entries = Object.entries(properties);
    if (!entries.length) return;

    for (const [k, v] of entries) {
      const row = this.doc.createElement("div");
      row.className = "propRow";
      const key = this.doc.createElement("div");
      key.className = "propKey";
      key.textContent = k;
      const value = this.doc.createElement("div");
      value.className = "propValue";
      value.textContent = typeof v === "string" ? v : JSON.stringify(v, null, 2);
      row.append(key, value);
      this.propTable.appendChild(row);
    }
  }
}
