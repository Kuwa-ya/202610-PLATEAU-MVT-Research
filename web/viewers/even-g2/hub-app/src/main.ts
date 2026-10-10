/*!
 * PLATEAU MVT Research — TypeScript source module
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

import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  OsEventTypeList,
  TextContainerProperty,
  TextContainerUpgrade
} from '@evenrealities/even_hub_sdk';
import { FALLBACK_LOCATION } from './config/defaults.js';
import { eventTypeOf, isDoubleClick, isScrollBottom, isScrollTop } from './hub-events.js';
import {
  G2_EVENT_LAYER,
  G2_IMAGE,
  G2_STATUS_META,
  G2_STATUS_PERF
} from './hub/g2-page-layout.js';
import { formatG2StatusMeta, formatG2StatusPerf } from './hub/g2-status-text.js';
import { nudgeCameraElevationDownDeg, nudgeCameraElevationUpDeg } from './view/view-camera-state.js';
import type { GeoFix } from './geo/geo-fix.js';
import { GpsSession } from './geo/gps-session.js';
import type { EvenHubBridge } from './hub/hub-runtime.js';
import { resolveHubRuntime } from './hub/hub-runtime.js';
import { FrameMetrics } from './metrics/frame-metrics.js';
import { mountPhonePanel } from './phone-panel.js';
import { setPhonePreviewPng } from './preview/phone-preview.js';
import { ViewPresenter } from './view/view-presenter.js';

declare global {
  interface Window {
    __g2Metrics?: FrameMetrics;
    __g2Gps?: GpsSession;
    __g2HubMode?: string;
  }
}

const IMG_W = G2_IMAGE.width;
const IMG_H = G2_IMAGE.height;

const metrics = new FrameMetrics();
const gpsSession = new GpsSession();
function fallbackFix(): GeoFix {
  return {
    latitude: FALLBACK_LOCATION.latitude,
    longitude: FALLBACK_LOCATION.longitude,
    accuracyM: null,
    headingDeg: null,
    at: new Date().toISOString()
  };
}

function resolveFix(): GeoFix {
  return gpsSession.getLatestFix() ?? fallbackFix();
}

async function bootstrap() {
  const runtime = await resolveHubRuntime();

  let pageReady = false;
  let rendering: Promise<void> = Promise.resolve();
  let evenBridge: EvenHubBridge | null = null;

  if (runtime.mode === 'even') {
    evenBridge = runtime.bridge;
    const eventLayer = new TextContainerProperty({
      xPosition: G2_EVENT_LAYER.x,
      yPosition: G2_EVENT_LAYER.y,
      width: G2_EVENT_LAYER.width,
      height: G2_EVENT_LAYER.height,
      borderWidth: 0,
      borderColor: 0,
      paddingLength: 0,
      containerID: G2_EVENT_LAYER.containerID,
      containerName: G2_EVENT_LAYER.containerName,
      content: ' ',
      isEventCapture: 1
    });

    const statusMeta = new TextContainerProperty({
      xPosition: G2_STATUS_META.x,
      yPosition: G2_STATUS_META.y,
      width: G2_STATUS_META.width,
      height: G2_STATUS_META.height,
      borderWidth: 0,
      borderColor: 5,
      paddingLength: 2,
      containerID: G2_STATUS_META.containerID,
      containerName: G2_STATUS_META.containerName,
      content: '読み込み中…',
      isEventCapture: 0
    });

    const statusPerf = new TextContainerProperty({
      xPosition: G2_STATUS_PERF.x,
      yPosition: G2_STATUS_PERF.y,
      width: G2_STATUS_PERF.width,
      height: G2_STATUS_PERF.height,
      borderWidth: 0,
      borderColor: 5,
      paddingLength: 2,
      containerID: G2_STATUS_PERF.containerID,
      containerName: G2_STATUS_PERF.containerName,
      content: ' ',
      isEventCapture: 0
    });

    const image = new ImageContainerProperty({
      xPosition: G2_IMAGE.x,
      yPosition: G2_IMAGE.y,
      width: G2_IMAGE.width,
      height: G2_IMAGE.height,
      containerID: G2_IMAGE.containerID,
      containerName: G2_IMAGE.containerName
    });

    const created = await evenBridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({
        containerTotalNum: 4,
        textObject: [eventLayer, statusMeta, statusPerf],
        imageObject: [image]
      })
    );
    pageReady = created === 0;
    if (!pageReady) {
      console.error('createStartUpPageContainer failed:', created);
    }
  }

  async function pushFrame(bytes: Uint8Array): Promise<{ sdkMs: number; result: string }> {
    if (!pageReady || !evenBridge) return { sdkMs: 0, result: 'pageNotReady' };
    const sdkStart = performance.now();
    let result = 'skipped';
    rendering = rendering.then(async () => {
      result = await evenBridge.updateImageRawData(
        new ImageRawDataUpdate({
          containerID: 3,
          containerName: 'plateauFrame',
          imageData: bytes
        })
      );
      if (result !== 'success') {
        console.error('updateImageRawData:', result);
      }
    });
    await rendering;
    return { sdkMs: performance.now() - sdkStart, result };
  }

  async function setG2StatusPanels(meta: string, perf: string) {
    if (!pageReady || !evenBridge) return;
    await evenBridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: G2_STATUS_META.containerID,
        containerName: G2_STATUS_META.containerName,
        content: meta
      })
    );
    await evenBridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: G2_STATUS_PERF.containerID,
        containerName: G2_STATUS_PERF.containerName,
        content: perf
      })
    );
  }

  let phonePanel = { refresh: () => {} };

  const viewPresenter = new ViewPresenter(
    resolveFix,
    { width: IMG_W, height: IMG_H },
    {
      onFrame: async (sample, detail) => {
        setPhonePreviewPng(detail.bytes);
        let sdkMs = 0;
        let sdkResult = 'simulation';
        if (runtime.mode === 'even' && pageReady) {
          const pushed = await pushFrame(detail.bytes);
          sdkMs = pushed.sdkMs;
          sdkResult = pushed.result;
        }
        const complete = { ...sample, sdkMs, sdkResult };
        metrics.record(complete);
        console.info('[g2-metrics]', complete, {
          hub: runtime.mode,
          mesh: detail.meshCode,
          movementBearingDeg: detail.movementBearingDeg,
          dataFetched: detail.dataFetched
        });
        phonePanel.refresh();
        if (runtime.mode === 'even' && pageReady) {
          const fix = resolveFix();
          await setG2StatusPanels(
            formatG2StatusMeta(fix, detail),
            formatG2StatusPerf(complete, sdkResult)
          );
        }
      }
    }
  );

  phonePanel = mountPhonePanel(
    metrics,
    gpsSession,
    () => {
      viewPresenter.present('tick', true).catch(console.error);
    },
    {
      hubMode: runtime.mode,
      hubDetail: runtime.mode === 'simulation' ? runtime.reason : 'Even Hub'
    },
    () => {
      viewPresenter.onUserRingTap().catch(console.error);
    }
  );

  window.__g2Metrics = metrics;
  window.__g2Gps = gpsSession;
  window.__g2HubMode = runtime.mode;

  try {
    await viewPresenter.present('init', true);
    viewPresenter.start();
  } catch (error) {
    console.error(error);
    if (runtime.mode === 'even' && pageReady) {
      await setG2StatusPanels(
        `建物描画失敗`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  gpsSession.start(
    fix => {
      viewPresenter.noteFix(fix);
    },
    () => phonePanel.refresh()
  );

  let cleanedUp = false;
  function cleanup() {
    if (cleanedUp) return;
    cleanedUp = true;
    viewPresenter.stop();
    gpsSession.stop();
    unsubscribe();
  }

  let unsubscribe = () => {};
  let lastScrollAdjustMs = 0;
  if (runtime.mode === 'even' && evenBridge) {
    unsubscribe = evenBridge.onEvenHubEvent(event => {
      if (!pageReady) return;
      if (isDoubleClick(event)) {
        evenBridge.shutDownPageContainer(1);
        return;
      }

      const now = performance.now();
      if (isScrollTop(event)) {
        if (now - lastScrollAdjustMs >= 280) {
          lastScrollAdjustMs = now;
          nudgeCameraElevationUpDeg();
          viewPresenter.present('tick', true).catch(console.error);
        }
        return;
      }
      if (isScrollBottom(event)) {
        if (now - lastScrollAdjustMs >= 280) {
          lastScrollAdjustMs = now;
          nudgeCameraElevationDownDeg();
          viewPresenter.present('tick', true).catch(console.error);
        }
        return;
      }

      const sysType = eventTypeOf(event.sysEvent);
      const textType = eventTypeOf(event.textEvent);

      if (sysType === OsEventTypeList.CLICK_EVENT || textType === OsEventTypeList.CLICK_EVENT) {
        viewPresenter.onUserRingTap().catch(console.error);
        return;
      }

      if (
        sysType === OsEventTypeList.SYSTEM_EXIT_EVENT
        || sysType === OsEventTypeList.ABNORMAL_EXIT_EVENT
      ) {
        cleanup();
      }
    });
  }

  window.addEventListener('beforeunload', cleanup);
}

bootstrap().catch(error => {
  console.error('[hub] bootstrap failed', error);
  const root = document.querySelector('#app');
  if (root) {
    root.innerHTML = `<p style="padding:16px;font-family:system-ui">起動失敗: ${error instanceof Error ? error.message : String(error)}</p>`;
  }
});
