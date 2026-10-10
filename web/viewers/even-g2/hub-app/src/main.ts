import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  OsEventTypeList,
  TextContainerProperty,
  TextContainerUpgrade,
  waitForEvenAppBridge
} from '@evenrealities/even_hub_sdk';
import { eventTypeOf, isDoubleClick } from './hub-events.js';
import { loadImageBytes } from './image/bytes.js';
import { FrameMetrics, type FrameSample } from './metrics/frame-metrics.js';
import { mountPhonePanel } from './phone-panel.js';

const PREVIEW_URL = `${import.meta.env.BASE_URL}preview.png`;

/** G2 画面は 576×288。画像コンテナは幅・高さそれぞれ半分（288×144）まで。 */
const IMG_W = 288;
const IMG_H = 144;

const metrics = new FrameMetrics();
const phonePanel = mountPhonePanel(metrics);

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

async function loadPreviewFrame(): Promise<FrameSample> {
  const totalStart = performance.now();
  const fetchStart = performance.now();
  const bytes = await loadImageBytes(PREVIEW_URL);
  const fetchMs = performance.now() - fetchStart;
  const { sdkMs, result } = await pushFrame(bytes);
  const sample: FrameSample = {
    at: new Date().toISOString(),
    bytes: bytes.byteLength,
    fetchMs,
    sdkMs,
    totalMs: performance.now() - totalStart,
    sdkResult: result
  };
  metrics.record(sample);
  console.info('[g2-metrics]', sample);
  phonePanel.refresh();
  if (pageReady) {
    const hint = result === 'success' ? ' · タップ再送' : ` · ${result}`;
    await setStatus(`${metrics.formatG2Status(sample)}${hint}`);
  }
  return sample;
}

declare global {
  interface Window {
    __g2Metrics?: FrameMetrics;
  }
}
window.__g2Metrics = metrics;

let unsubscribe = () => {};

if (pageReady) {
  try {
    await loadPreviewFrame();
  } catch (error) {
    console.error(error);
    await setStatus('preview.png がありません。public/preview.png を配置してください。');
  }
}

let cleanedUp = false;
function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
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
    loadPreviewFrame().catch(err => console.error(err));
    return;
  }

  if (sysType === OsEventTypeList.SYSTEM_EXIT_EVENT || sysType === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
    cleanup();
  }
});

window.addEventListener('beforeunload', cleanup);
