/*!
 * PLATEAU MVT Research — JavaScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: /legal/SOURCE-CODE-LICENSE.txt
 */

import { MVT_VIEWER_LAYERS } from '../../../../shared/mvt/viewer-mvt-layers.js';

export function bindViewUi(document) {
  const elements = {
    workspace: document.querySelector('.workspace'),
    menuToggle: document.querySelector('#menu-toggle'),
    status: document.querySelector('#status'),
    hint: document.querySelector('#mvt-hint'),
    loading: document.querySelector('#loading'),
    loadingMessage: document.querySelector('#loading-message'),
    terrainVisibility: document.querySelector('#terrain-visibility'),
    buildingVisibility: document.querySelector('#building-visibility'),
    buildingStatus: document.querySelector('#building-status'),
    textureType: document.querySelector('#texture-type'),
    jprcZone: document.querySelector('#jprc-zone'),
    centerTile: document.querySelector('#center-tile'),
    demTile: document.querySelector('#dem-tile'),
    textureTiles: document.querySelector('#texture-tiles'),
    vertexCount: document.querySelector('#vertex-count'),
    cacheStatus: document.querySelector('#cache-status'),
    viewerCurrentLod: document.querySelector('#viewer-current-lod'),
    viewerRequestedLod: document.querySelector('#viewer-requested-lod'),
    viewerRequestedRow: document.querySelector('#viewer-requested-row'),
    requestedLod: document.querySelector('#requested-lod'),
    toggleMvtLuse: document.querySelector('#toggle-mvt-luse'),
    toggleMvtRoad: document.querySelector('#toggle-mvt-road'),
    toggleMvtUseDistrict: document.querySelector('#toggle-mvt-usedistrict'),
    addressSearchInput: document.querySelector('#address-search-input'),
    addressSearchSubmit: document.querySelector('#address-search-submit'),
    addressSearchStatus: document.querySelector('#address-search-status'),
    originLatitude: document.querySelector('#origin-latitude'),
    originLongitude: document.querySelector('#origin-longitude'),
    originApply: document.querySelector('#origin-apply'),
    originStatus: document.querySelector('#origin-status'),
    currentLatitude: document.querySelector('#current-latitude'),
    currentLongitude: document.querySelector('#current-longitude'),
    cameraDistance: document.querySelector('#camera-distance'),
    mvtTileCount: document.querySelector('#mvt-tile-count'),
    mvtPlanned: document.querySelector('#mvt-planned'),
    localOrigin: document.querySelector('#local-origin'),
    viewerMvtMode: document.querySelector('#viewer-mvt-mode'),
    viewerMvtTiles: document.querySelector('#viewer-mvt-tiles')
  };

  elements.menuToggle?.addEventListener('click', () => {
    const collapsed = elements.workspace.classList.toggle('menu-collapsed');
    elements.menuToggle.setAttribute('aria-expanded', String(!collapsed));
  });

  return elements;
}

const TOGGLE_BY_KIND = {
  luse: 'toggleMvtLuse',
  road: 'toggleMvtRoad',
  useDistrict: 'toggleMvtUseDistrict'
};

export function isMvtLayerVisible(elements, kind) {
  const key = TOGGLE_BY_KIND[kind];
  const button = key ? elements[key] : null;
  if (!button) return kind === 'luse';
  return button.getAttribute('aria-pressed') === 'true';
}

export function setMvtLayerToggle(elements, kind, visible) {
  const key = TOGGLE_BY_KIND[kind];
  const button = key ? elements[key] : null;
  if (button) button.setAttribute('aria-pressed', String(Boolean(visible)));
}

export function readEnabledDatasets(elements) {
  const ids = [];
  for (const layer of MVT_VIEWER_LAYERS) {
    if (isMvtLayerVisible(elements, layer.kind)) ids.push(layer.datasetId);
  }
  return ids;
}

export function setStatus(elements, message, isError = false) {
  if (!elements.status) return;
  elements.status.textContent = message;
  elements.status.classList.toggle('error', isError);
}

export function setLoading(elements, visible, message) {
  if (elements.loading) elements.loading.hidden = !visible;
  if (message && elements.loadingMessage) elements.loadingMessage.textContent = message;
}

export function formatCoord(value) {
  return Number(value).toFixed(8);
}

export function updateMetadata(elements, payload) {
  const {
    viewLat, viewLon, distance, tileCount, planned, origin, mvtMode, mvtTilesLabel, statusLine, hintLine
  } = payload;
  if (elements.currentLatitude) elements.currentLatitude.textContent = formatCoord(viewLat);
  if (elements.currentLongitude) elements.currentLongitude.textContent = formatCoord(viewLon);
  if (elements.cameraDistance) elements.cameraDistance.textContent = `${Math.round(distance)} m`;
  if (elements.mvtTileCount) elements.mvtTileCount.textContent = String(tileCount);
  if (elements.mvtPlanned) elements.mvtPlanned.textContent = String(planned);
  if (elements.localOrigin) {
    elements.localOrigin.textContent = `${formatCoord(origin.lat)}, ${formatCoord(origin.lon)}`;
  }
  if (elements.viewerMvtMode) elements.viewerMvtMode.textContent = mvtMode;
  if (elements.viewerMvtTiles) elements.viewerMvtTiles.textContent = mvtTilesLabel;
  if (statusLine) setStatus(elements, statusLine, payload.isError);
  if (elements.hint && hintLine) elements.hint.textContent = hintLine;
}
