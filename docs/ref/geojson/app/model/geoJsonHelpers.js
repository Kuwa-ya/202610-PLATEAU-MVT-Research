/**
 * 【役割】GeoJSON を扱う純関数ユーティリティ集（正規化、属性キー抽出、フィルタ、色分け）。
 * 【レイヤ】Model（副作用なし）
 * 【依存】なし
 * 【公開】各 export 関数
 * 【補足】UI/通信/地図ライブラリに依存させない。カテゴリ色は黄金角で HSL から動的生成する。
 */
export function randomId(prefix = "layer") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function collectPropertyKeys(featureCollection) {
  const keys = new Set();
  for (const f of featureCollection.features ?? []) {
    const props = f?.properties;
    if (!props || typeof props !== "object") continue;
    for (const k of Object.keys(props)) keys.add(k);
  }
  return Array.from(keys).sort((a, b) => a.localeCompare(b, "ja"));
}

/**
 * 複数の FeatureCollection にまたがる properties キーの和集合（ソート済み）。
 * @param {Array<{ features?: any[] }>} featureCollections
 */
export function collectPropertyKeysUnion(featureCollections) {
  const keys = new Set();
  for (const fc of featureCollections) {
    for (const k of collectPropertyKeys(fc ?? { type: "FeatureCollection", features: [] })) keys.add(k);
  }
  return Array.from(keys).sort((a, b) => a.localeCompare(b, "ja"));
}

/**
 * 複数 FeatureCollection にまたがる「ラベル候補キー」の和集合（ネスト展開）。
 * 例: `shadeRegulation.note` のように親子を `.` で連結する。
 * @param {Array<{ features?: any[] }>} featureCollections
 */
export function collectNestedPropertyKeysUnion(featureCollections) {
  const keys = new Set();
  for (const fc of featureCollections) {
    for (const f of fc?.features ?? []) {
      const props = f?.properties;
      if (!props || typeof props !== "object") continue;
      _collectNestedPathsFromObject(props, "", keys, 0);
    }
  }
  return Array.from(keys).sort((a, b) => a.localeCompare(b, "ja"));
}

/**
 * Object の葉に当たるパスを `keys` へ追加する（配列は葉として採用しつつ、要素が object なら掘る）。
 * @param {Record<string, any>} obj
 * @param {string} prefix
 * @param {Set<string>} keys
 * @param {number} depth
 */
function _collectNestedPathsFromObject(obj, prefix, keys, depth) {
  if (!obj || typeof obj !== "object") return;
  if (depth > 6) return;

  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;

    if (Array.isArray(v)) {
      // 配列はそのキー自体を候補化する（例: `shadeRegulation.note`）
      keys.add(path);

      // 配列要素が object ならその内部キーも展開する。
      for (const item of v) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          _collectNestedPathsFromObject(item, path, keys, depth + 1);
        }
      }
      continue;
    }

    if (v && typeof v === "object") {
      _collectNestedPathsFromObject(v, path, keys, depth + 1);
      continue;
    }

    // primitive / null は葉として候補化する。
    keys.add(path);
  }
}

/**
 * ドット区切りパスで object / 配列を辿って値を取得する（ラベル表示のキー形式と同一）。
 * 途中が配列のときは各要素に対して「同じセグメント位置から」残りパスを辿り、複数値は配列で返す（1 件ならスカラー）。
 * @param {any} root 通常は feature.properties
 * @param {string} path
 * @returns {any}
 */
export function getPropertyValueByPath(root, path) {
  if (root == null || typeof path !== "string" || !path.trim()) return undefined;
  const parts = path.split(".");
  return _walkPropertyPath(root, parts, 0);
}

/**
 * @param {any} cur
 * @param {string[]} parts
 * @param {number} i
 */
function _walkPropertyPath(cur, parts, i) {
  if (i >= parts.length) return cur;
  if (cur == null) return undefined;

  if (Array.isArray(cur)) {
    const acc = [];
    for (const el of cur) {
      const v = _walkPropertyPath(el, parts, i);
      if (v !== undefined) acc.push(v);
    }
    if (!acc.length) return undefined;
    if (acc.length === 1) return acc[0];
    return acc;
  }

  if (typeof cur !== "object") return undefined;
  return _walkPropertyPath(cur[parts[i]], parts, i + 1);
}

/** フィルタ比較用にパス解決結果を文字列列へフラット化する。 */
function _comparableStringsFromResolvedValue(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.flatMap((x) => _comparableStringsFromResolvedValue(x));
  return [propertyValueToCategoryString(raw)];
}

/** カテゴリ色分け・統一パレットで共有するための値の正規化文字列。 */
export function propertyValueToCategoryString(v) {
  if (v === null) return "(null)";
  if (v === undefined) return "(undefined)";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/**
 * 1 件のフィルタ条件に properties が合致するか（ネストパス・配列対応）。
 * @param {Record<string, any>} props
 * @param {{ key: string, value: string, exact?: boolean }} criterion
 */
export function featureMatchesFilterCriterion(props, { key, value, exact }) {
  const k = String(key ?? "").trim();
  const v = String(value ?? "");
  if (!k || !v) return true;
  const raw = getPropertyValueByPath(props, k);
  const strings = _comparableStringsFromResolvedValue(raw);
  if (!strings.length) return false;
  return strings.some((s) => (exact ? s === v : s.includes(v)));
}

/**
 * 有効な条件をすべて満たすフィーチャだけ残す（AND）。条件が空なら `fc` をそのまま返す。
 * @param {{ features?: any[] }} fc
 * @param {Array<{ key?: string, value?: string, exact?: boolean }>} criteriaList
 */
export function applyFiltersToFeatureCollection(fc, criteriaList) {
  const active = (criteriaList ?? [])
    .map((c) => ({
      key: String(c?.key ?? "").trim(),
      value: String(c?.value ?? ""),
      exact: !!c?.exact,
    }))
    .filter((c) => c.key && c.value);
  if (!active.length) return fc;

  const features = (fc.features ?? []).filter((f) => {
    const props = f?.properties ?? {};
    return active.every((c) => featureMatchesFilterCriterion(props, c));
  });
  return { type: "FeatureCollection", features };
}

/** @deprecated 単一条件用。内部で {@link applyFiltersToFeatureCollection} に委譲。 */
export function applyFilterToFeatureCollection(fc, { key, value, exact }) {
  return applyFiltersToFeatureCollection(fc, [{ key, value, exact }]);
}

/** 色相を黄金角（度）だけずらして周上を均等に埋める（可視化でよく使う定数）。 */
const GOLDEN_ANGLE_HUE_STEP_DEG = 137.508;

/**
 * HSL（0–360, 0–100, 0–100）を #rrggbb に変換する。
 * @param {number} h
 * @param {number} s
 * @param {number} l
 */
function hslToHex(h, s, l) {
  const H = ((h % 360) + 360) % 360;
  const S = s / 100;
  const L = l / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const hp = H / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = L - c / 2;
  const toHex = (v) =>
    Math.round(255 * Math.min(1, Math.max(0, v + m)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * カテゴリ連番 `index`（0 起算）に対応する色を黄金角で生成する。件数に上限はなく、必要な分だけ順に呼べる。
 * @param {number} index
 */
export function categoricalColorGoldenAngleAtIndex(index) {
  const i = Math.max(0, Math.floor(Number(index)) || 0);
  const h = (i * GOLDEN_ANGLE_HUE_STEP_DEG) % 360;
  const s = 62 + (i % 5) * 4;
  const l = 48 + (i % 4) * 3;
  return hslToHex(h, s, l);
}

export function makeCategoricalColorizer(key) {
  const map = new Map();

  function colorForFeature(feature) {
    const props = feature?.properties ?? {};
    const raw = getPropertyValueByPath(props, key);
    const vs = propertyValueToCategoryString(raw);
    if (!map.has(vs)) {
      map.set(vs, categoricalColorGoldenAngleAtIndex(map.size));
    }
    return map.get(vs);
  }

  return { colorForFeature };
}

/**
 * 複数レイヤ間で「同じ属性値は同じ色」になるよう、全 FeatureCollection を走査してからパレットを割り当てる。
 * @param {Array<{ features?: any[] }>} featureCollections
 * @param {string} key
 */
export function makeUnifiedCategoricalColorizer(featureCollections, key) {
  const values = new Set();
  for (const fc of featureCollections) {
    for (const f of fc?.features ?? []) {
      const props = f?.properties ?? {};
      const raw = getPropertyValueByPath(props, key);
      values.add(propertyValueToCategoryString(raw));
    }
  }
  const sorted = Array.from(values).sort((a, b) => a.localeCompare(b, "ja"));
  const colorByValue = new Map();
  sorted.forEach((vs, i) => colorByValue.set(vs, categoricalColorGoldenAngleAtIndex(i)));

  function colorForFeature(feature) {
    const props = feature?.properties ?? {};
    const raw = getPropertyValueByPath(props, key);
    const vs = propertyValueToCategoryString(raw);
    return colorByValue.get(vs) ?? "#9ca3af";
  }

  return { key, colorForFeature };
}
