/*!
 * PLATEAU MVT Research — JavaScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: /legal/SOURCE-CODE-LICENSE.txt
 *
 * ALL RIGHTS RESERVED. NO LICENSE IS GRANTED BY ACCESSING, VIEWING, OR COPYING THIS FILE.
 * THIS SOFTWARE AND ALL ASSOCIATED MATERIALS ARE PROPRIETARY TO KUWA-YA, LTD.
 * SOURCE CODE IS MADE PUBLICLY VIEWABLE ONLY FOR TRANSPARENCY AND INFORMATIONAL
 * PURPOSES. WITHOUT PRIOR WRITTEN PERMISSION FROM KUWA-YA, LTD., YOU MAY NOT USE,
 * COPY, REPRODUCE, MODIFY, ADAPT, TRANSLATE, CREATE DERIVATIVE WORKS FROM,
 * DISTRIBUTE, REDISTRIBUTE, PUBLISH, SUBLICENSE, SELL, RENT, LEASE, OR OTHERWISE
 * MAKE AVAILABLE ANY PART OF THIS SOFTWARE, OR USE IT FOR COMMERCIAL PURPOSES OR
 * TO DEVELOP OR PROVIDE ANY PRODUCT OR SERVICE. VIEWING DOES NOT GRANT ANY RIGHTS.
 * USE OF THE PUBLIC WEB APPLICATION IS GOVERNED BY ITS TERMS OF SERVICE ONLY AND
 * DOES NOT GRANT ANY RIGHT TO THIS SOURCE CODE. THE SOFTWARE IS PROVIDED "AS IS"
 * WITHOUT WARRANTY OF ANY KIND. SEE /legal/SOURCE-CODE-LICENSE.txt.
 */

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
    luseVisibility: document.querySelector('#luse-visibility'),
    tranVisibility: document.querySelector('#tran-visibility'),
    useDistrictVisibility: document.querySelector('#usedistrict-visibility'),
    originLatitude: document.querySelector('#origin-latitude'),
    originLongitude: document.querySelector('#origin-longitude'),
    originApply: document.querySelector('#origin-apply'),
    originStatus: document.querySelector('#origin-status'),
    viewReset: document.querySelector('#view-reset'),
    viewZoomMvt: document.querySelector('#view-zoom-mvt'),
    currentLatitude: document.querySelector('#current-latitude'),
    currentLongitude: document.querySelector('#current-longitude'),
    cameraDistance: document.querySelector('#camera-distance'),
    mvtTileCount: document.querySelector('#mvt-tile-count'),
    mvtPlanned: document.querySelector('#mvt-planned'),
    localOrigin: document.querySelector('#local-origin'),
    viewerMvtMode: document.querySelector('#viewer-mvt-mode'),
    viewerMvtTiles: document.querySelector('#viewer-mvt-tiles'),
  };

  elements.menuToggle?.addEventListener('click', () => {
    const collapsed = elements.workspace.classList.toggle('menu-collapsed');
    elements.menuToggle.setAttribute('aria-expanded', String(!collapsed));
  });

  const layerTabs = [...document.querySelectorAll('.layer-tabs [role="tab"]')];
  function activateLayerTab(tab) {
    for (const candidate of layerTabs) {
      const selected = candidate === tab;
      candidate.classList.toggle('selected', selected);
      candidate.setAttribute('aria-selected', String(selected));
      candidate.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(candidate.getAttribute('aria-controls'));
      if (panel) panel.hidden = !selected;
    }
  }
  for (const [index, tab] of layerTabs.entries()) {
    tab.addEventListener('click', () => activateLayerTab(tab));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const nextIndex = event.key === 'Home' ? 0
        : event.key === 'End' ? layerTabs.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + layerTabs.length) % layerTabs.length;
      activateLayerTab(layerTabs[nextIndex]);
      layerTabs[nextIndex].focus();
    });
  }

  return elements;
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

export function readEnabledDatasets(elements) {
  const ids = [];
  if (elements.luseVisibility?.value !== 'hide') ids.push('luse-2025');
  if (elements.tranVisibility?.value !== 'hide') ids.push('tran-lod1-2025');
  if (elements.useDistrictVisibility?.value === 'show') ids.push('use-district-2025');
  return ids;
}
