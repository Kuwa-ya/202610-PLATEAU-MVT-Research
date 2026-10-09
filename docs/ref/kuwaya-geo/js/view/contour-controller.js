/*!
 * ちずうつし (kuwaya-geo) — JavaScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: ./legal/SOURCE-CODE-LICENSE.txt
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
 * WITHOUT WARRANTY OF ANY KIND. SEE ./legal/SOURCE-CODE-LICENSE.txt.
 */

import { createContourLayer, disposeContourLayer } from './terrain-layer.js';

export function createContourController(THREE, options) {
  let group = null;
  let segments = [];
  let updateGeneration = 0;

  const settingForLod = detailLevel => options.levels.find(level => detailLevel >= level.minLod)
    ?? options.levels[options.levels.length - 1];
  const intervalForLod = detailLevel => settingForLod(detailLevel).interval;
  const getInterval = () => options.elements.contourInterval.value !== 'auto'
    ? Number(options.elements.contourInterval.value)
    : intervalForLod(options.getTerrainSetting()?.detailLevel ?? 17);

  function applyUpdate() {
    disposeContourLayer(options.scene, group);
    group = null;
    segments = [];
    const terrainSetting = options.getTerrainSetting();
    const terrainData = options.getTerrainData();
    const interval = options.elements.contourVisibility.value === 'show'
      ? intervalForLod(terrainSetting?.detailLevel ?? 17)
      : 0;
    if (!interval || terrainData.length === 0) {
      options.elements.contourStatus.textContent = interval
        ? '表示できる地形を読み込んでいます。'
        : '等高線表示はオフです。';
      options.onChange?.();
      return;
    }
    const detailLevel = terrainSetting?.detailLevel ?? options.offsetBaseLod;
    const result = createContourLayer(THREE, options.document, terrainData, {
      interval,
      detailLevel,
      majorEvery: options.majorEvery,
      minorColor: options.minorColor,
      majorColor: options.majorColor,
      offsetBaseLod: options.offsetBaseLod,
      offsetMin: options.offsetMin,
      offsetMax: options.offsetMax,
      contourSetting: settingForLod(detailLevel)
    });
    group = result.group;
    segments = result.segments;
    if (group.children.length > 0) options.scene.add(group);
    options.elements.contourStatus.textContent = `${interval} m間隔／主曲線${interval * options.majorEvery} m／表示オフセット${result.surfaceOffset.toFixed(1)} m／${segments.length.toLocaleString('ja-JP')}線分`;
    options.onChange?.();
  }

  function update() {
    updateGeneration += 1;
    applyUpdate();
  }

  async function scheduleUpdate() {
    const generation = ++updateGeneration;
    if (options.scheduler?.whenIdle) {
      await options.scheduler.whenIdle(options.idleTimeout ?? 2000);
    }
    if (generation !== updateGeneration) return;
    applyUpdate();
  }

  return {
    update,
    scheduleUpdate,
    getGroup: () => group,
    getSegments: () => segments,
    getInterval,
    settingForLod,
    intervalForLod
  };
}
