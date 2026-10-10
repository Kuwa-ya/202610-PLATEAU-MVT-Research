/** B.4 — クリック時は luse を useDistrict より優先 */
const RENDERED_KIND_PICK_RANK = { luse: 0, useDistrict: 1, road: 2 };

function renderedKindRank(kind) {
  return RENDERED_KIND_PICK_RANK[kind] ?? 3;
}

/**
 * MapLibre queryRenderedFeatures 結果の重複排除。
 * 同一 gml_id / mvt_id は **ID のみ**でグループ化し、頂点数が多い（欠落が少ない）方を残す。
 * ID が無い feature だけジオメトリ署名で区別する。
 */

export function mvtFeatureId(properties) {
  if (!properties) return null;
  const raw = properties.gml_id ?? properties.mvt_id;
  if (raw === undefined || raw === null || raw === '') return null;
  return String(raw);
}

export function geometryVertexCount(geometry) {
  if (!geometry) return 0;
  const ringLen = ring => (Array.isArray(ring) ? ring.length : 0);
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.reduce((sum, ring) => sum + ringLen(ring), 0);
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.reduce(
      (sum, poly) => sum + poly.reduce((inner, ring) => inner + ringLen(ring), 0),
      0
    );
  }
  return 0;
}

function geometrySignature(feature) {
  if (!feature?.geometry) return '';
  const normalize = value => {
    if (Array.isArray(value)) return value.map(normalize);
    return typeof value === 'number' ? Number(value.toFixed(7)) : value;
  };
  return `${feature.geometry.type}:${JSON.stringify(normalize(feature.geometry.coordinates))}`;
}

/**
 * @param {import('@mapbox/geojson-types').Feature[]} features
 * @param {(layerId: string) => string} layerKindFromId
 */
export function dedupeRenderedFeaturesById(features, layerKindFromId) {
  const bestByKey = new Map();

  for (const feature of features) {
    const layerId = feature.layer?.id ?? '';
    const kind = layerKindFromId(layerId);
    const id = mvtFeatureId(feature.properties);
    const key =
      id != null ? `${kind}:id:${id}` : `${kind}:no-id:${geometrySignature(feature)}`;
    const vertices = geometryVertexCount(feature.geometry);
    const prev = bestByKey.get(key);
    if (!prev || vertices > prev.vertices) {
      bestByKey.set(key, { feature, vertices });
    }
  }

  const winners = new Set([...bestByKey.values()].map(entry => entry.feature));
  return features.filter(f => winners.has(f));
}

/**
 * クリック位置の rendered features から 1 件選択（検証用 debug 付き）。
 * @param {boolean} dedupe — false なら MapLibre 返却順の先頭（最前面）のみ
 */
export function pickRenderedFeature(rawFeatures, { dedupe, layerKindFromId }) {
  const list = Array.isArray(rawFeatures) ? rawFeatures : [];
  const hits = list.map((feature, order) => {
    const layerId = feature.layer?.id ?? '';
    const kind = layerKindFromId(layerId);
    const featureId = mvtFeatureId(feature.properties);
    return {
      order,
      layerId,
      kind,
      featureId: featureId ?? '—',
      vertices: geometryVertexCount(feature.geometry)
    };
  });

  const pool = dedupe ? dedupeRenderedFeaturesById(list, layerKindFromId) : [...list];
  pool.sort((a, b) => {
    const ka = layerKindFromId(a.layer?.id ?? '');
    const kb = layerKindFromId(b.layer?.id ?? '');
    const ra = renderedKindRank(ka);
    const rb = renderedKindRank(kb);
    if (ra !== rb) return ra - rb;
    return 0;
  });
  const feature = pool[0] ?? null;

  let chosenOrder = null;
  if (feature) {
    chosenOrder = list.indexOf(feature);
    if (chosenOrder < 0) chosenOrder = 0;
  }

  const hitsWithFlags = hits.map(hit => ({
    ...hit,
    isChosen: hit.order === chosenOrder
  }));

  return {
    feature,
    debug: {
      dedupeEnabled: Boolean(dedupe),
      rawCount: list.length,
      poolCount: pool.length,
      hits: hitsWithFlags
    }
  };
}
