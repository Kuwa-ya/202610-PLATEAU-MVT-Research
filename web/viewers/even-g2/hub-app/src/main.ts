import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  OsEventTypeList,
  TextContainerProperty,
  TextContainerUpgrade,
  waitForEvenAppBridge
} from '@evenrealities/even_hub_sdk';
import { FALLBACK_LOCATION } from './config/defaults.js';
import { eventTypeOf, isDoubleClick } from './hub-events.js';
import { formatFixShort, type GeoFix } from './geo/geo-fix.js';
import { GpsSession } from './geo/gps-session.js';
import { FrameMetrics, type FrameSample, type FrameTrigger } from './metrics/frame-metrics.js';
import { mountPhonePanel } from './phone-panel.js';
import { setPhonePreviewPng } from './preview/phone-preview.js';
import { buildBuildingFrame } from './plateau/building-frame.js';

/** G2 画面は 576×288。画像コンテナは幅・高さそれぞれ半分（288×144）まで。 */
const IMG_W = 288;
const IMG_H = 144;

const metrics = new FrameMetrics();
const gpsSession = new GpsSession();
const phonePanel = mountPhonePanel(metrics, gpsSession);

const bridge = await waitForEvenAppBridge();

const eventLayer = new TextContainerProperty({
  xPosition: 0,
  yPosition: 0,
  width: 576,
  height: 288,
  borderWidth: 0,
  borderColor: 0,
  paddingLength: 0,
  containerID: 1,
  containerName: 'eventLayer',
  content: ' ',
  isEventCapture: 1
});

const statusLine = new TextContainerProperty({
  xPosition: 0,
  yPosition: 220,
  width: 576,
  height: 40,
  borderWidth: 0,
  borderColor: 5,
  paddingLength: 4,
  containerID: 2,
  containerName: 'status',
  content: '読み込み中…',
  isEventCapture: 0
});

const image = new ImageContainerProperty({
  xPosition: Math.floor((576 - IMG_W) / 2),
  yPosition: 24,
  width: IMG_W,
  height: IMG_H,
  containerID: 3,
  containerName: 'plateauFrame'
});

const created = await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({
    containerTotalNum: 3,
    textObject: [eventLayer, statusLine],
    imageObject: [image]
  })
);
const pageReady = created === 0;
if (!pageReady) {
  console.error('createStartUpPageContainer failed:', created);
}

async function setStatus(text: string) {
  if (!pageReady) return;
  await bridge.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: 2,
      containerName: 'status',
      content: text
    })
  );
}

let rendering: Promise<void> = Promise.resolve();

async function pushFrame(bytes: Uint8Array): Promise<{ sdkMs: number; result: string }> {
  if (!pageReady) return { sdkMs: 0, result: 'pageNotReady' };
  const sdkStart = performance.now();
  let result = 'skipped';
  rendering = rendering.then(async () => {
    result = await bridge.updateImageRawData(
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

function fixFromGps(fix?: GeoFix | null): GeoFix {
  if (fix) return fix;
  return {
    latitude: FALLBACK_LOCATION.latitude,
    longitude: FALLBACK_LOCATION.longitude,
    accuracyM: null,
    at: new Date().toISOString()
  };
}

async function loadBuildingFrame(
  trigger: FrameTrigger,
  fix?: GeoFix | null
): Promise<FrameSample> {
  const location = fixFromGps(fix);
  const totalStart = performance.now();
  const fetchStart = performance.now();
  const built = await buildBuildingFrame({
    latitude: location.latitude,
    longitude: location.longitude,
    width: IMG_W,
    height: IMG_H
  });
  const fetchMs = performance.now() - fetchStart;
  setPhonePreviewPng(built.bytes);
  const { sdkMs, result } = await pushFrame(built.bytes);
  const sample: FrameSample = {
    at: new Date().toISOString(),
    bytes: built.bytes.byteLength,
    fetchMs,
    sdkMs,
    totalMs: performance.now() - totalStart,
    sdkResult: result,
    trigger
  };
  metrics.record(sample);
  console.info('[g2-metrics]', sample, {
    mesh: built.meshCode,
    features: built.featureCount,
    rings: built.ringCount,
    geoMs: built.geoFetchMs,
    renderMs: built.renderMs
  });
  phonePanel.refresh();
  if (pageReady) {
    const coord = `${formatFixShort(location)} `;
    const hint = result === 'success' ? '' : ` · ${result}`;
    const meta = `bldg ${built.ringCount}面 · ${built.meshCode}`;
    await setStatus(`${coord}${meta} · ${metrics.formatG2Status(sample)}${hint}`);
  }
  return sample;
}

declare global {
  interface Window {
    __g2Metrics?: FrameMetrics;
    __g2Gps?: GpsSession;
  }
}
window.__g2Metrics = metrics;
window.__g2Gps = gpsSession;

let unsubscribe = () => {};

if (pageReady) {
  try {
    await loadBuildingFrame('init');
  } catch (error) {
    console.error(error);
    await setStatus(
      `建物描画失敗: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  gpsSession.start(
    (fix, reason) => {
      console.info('[gps-push]', reason, fix);
      loadBuildingFrame('gps', fix).catch(err => console.error(err));
    },
    () => phonePanel.refresh()
  );
}

let cleanedUp = false;
function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  gpsSession.stop();
  unsubscribe();
}

unsubscribe = bridge.onEvenHubEvent(event => {
  if (!pageReady) return;
  if (isDoubleClick(event)) {
    bridge.shutDownPageContainer(1);
    return;
  }

  const sysType = eventTypeOf(event.sysEvent);
  const textType = eventTypeOf(event.textEvent);

  if (sysType === OsEventTypeList.CLICK_EVENT || textType === OsEventTypeList.CLICK_EVENT) {
    loadBuildingFrame('tap', gpsSession.getLatestFix()).catch(err => console.error(err));
    return;
  }

  if (sysType === OsEventTypeList.SYSTEM_EXIT_EVENT || sysType === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
    cleanup();
  }
});

window.addEventListener('beforeunload', cleanup);
