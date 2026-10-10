/**
 * MVT クリック照会 — 2D Popup / 3D フローティング UI 共通 DOM
 */

import { inspectFieldsForLayerKind } from './feature-inspect.js';
import { formatUseDistrictSummary } from './use-district.js';

function kindTitle(kind) {
  if (kind === 'luse') return '土地利用';
  if (kind === 'useDistrict') return '用途地域';
  return '道路';
}

/**
 * @param {Document} documentRef
 * @param {{ kind: string, properties: object, overlappingUseDistricts?: object[] }} feature
 * @param {{ onClose?: () => void, showClose?: boolean }} [options]
 */
export function buildMvtFeaturePopupElement(documentRef, feature, options = {}) {
  const { kind, properties, overlappingUseDistricts = [] } = feature;
  const root = documentRef.createElement('div');
  root.className = 'mvt-feature-popup';

  if (options.showClose !== false) {
    const close = documentRef.createElement('button');
    close.type = 'button';
    close.className = 'mvt-feature-popup-close';
    close.setAttribute('aria-label', '閉じる');
    close.textContent = '×';
    close.addEventListener('click', event => {
      event.stopPropagation();
      options.onClose?.();
    });
    root.append(close);
  }

  const title = documentRef.createElement('div');
  title.className = 'mvt-feature-popup-label';
  title.textContent = kindTitle(kind);
  root.append(title);

  if (kind === 'useDistrict') {
    const summary = documentRef.createElement('div');
    summary.className = 'mvt-feature-popup-row mvt-feature-popup-row--summary';
    summary.textContent = formatUseDistrictSummary(properties);
    root.append(summary);
  }

  for (const field of inspectFieldsForLayerKind(kind, properties)) {
    const row = documentRef.createElement('div');
    row.className = 'mvt-feature-popup-row';
    row.textContent = `${field.label}: ${field.value}`;
    root.append(row);
  }

  const urfList = Array.isArray(overlappingUseDistricts) ? overlappingUseDistricts : [];
  if (kind === 'luse' && urfList.length) {
    const urfHead = documentRef.createElement('div');
    urfHead.className = 'mvt-feature-popup-label mvt-feature-popup-label--section';
    urfHead.textContent = `重畳する用途地域（${urfList.length}）`;
    root.append(urfHead);
    for (const props of urfList) {
      const block = documentRef.createElement('div');
      block.className = 'mvt-feature-popup-urf-block';
      const summary = documentRef.createElement('div');
      summary.className = 'mvt-feature-popup-row mvt-feature-popup-row--summary';
      summary.textContent = formatUseDistrictSummary(props);
      block.append(summary);
      for (const field of inspectFieldsForLayerKind('useDistrict', props)) {
        const row = documentRef.createElement('div');
        row.className = 'mvt-feature-popup-row';
        row.textContent = `${field.label}: ${field.value}`;
        block.append(row);
      }
      root.append(block);
    }
  }

  const featureId = properties.gml_id ?? properties.mvt_id;
  if (featureId != null && featureId !== '') {
    const idRow = documentRef.createElement('div');
    idRow.className = 'mvt-feature-popup-row mvt-feature-popup-row--muted';
    idRow.textContent = `gml_id: ${String(featureId)}`;
    root.append(idRow);
  }

  return root;
}

/** @param {{ clientX: number, clientY: number }} anchor */
export function positionFixedPopupElement(element, anchor, padding = 8) {
  const offset = 12;
  element.style.visibility = 'hidden';
  element.style.left = '0';
  element.style.top = '0';
  requestAnimationFrame(() => {
    const rect = element.getBoundingClientRect();
    let left = anchor.clientX + offset;
    let top = anchor.clientY + offset;
    left = Math.min(left, window.innerWidth - rect.width - padding);
    top = Math.min(top, window.innerHeight - rect.height - padding);
    left = Math.max(padding, left);
    top = Math.max(padding, top);
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
    element.style.visibility = '';
  });
}
