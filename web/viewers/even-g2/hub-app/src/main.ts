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

const PREVIEW_URL = `${import.meta.env.BASE_URL}preview.png`;

/** G2 画面は 576×288。画像コンテナは幅・高さそれぞれ半分（288×144）まで。 */
const IMG_W = 288;
const IMG_H = 144;

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
async function pushFrame(bytes: Uint8Array) {
  if (!pageReady) return;
  rendering = rendering.then(async () => {
    const result = await bridge.updateImageRawData(
      new ImageRawDataUpdate({
        containerID: 3,
        containerName: 'plateauFrame',
        imageData: bytes
      })
    );
    if (result !== 'success') {
      await setStatus(`描画: ${result}`);
      console.error('updateImageRawData:', result);
    }
  });
  await rendering;
}

async function loadPreviewFrame() {
  const bytes = await loadImageBytes(PREVIEW_URL);
  await pushFrame(bytes);
}

let unsubscribe = () => {};

if (pageReady) {
  try {
    await loadPreviewFrame();
    await setStatus('タップで再読込 · ダブルタップで終了');
  } catch (error) {
    console.error(error);
    await setStatus(
      'preview.png がありません。3D Viewer の PNG を public/preview.png に置いてください。'
    );
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

const app = document.querySelector('#app');
if (app) {
  const setupHint = pageReady
    ? ''
    : `<p style="color:#b45309">CreateStartUpPageContainer が失敗しました（コード ${created}）。画像は最大 288×144 px です。</p>`;
  app.innerHTML = `
    ${setupHint}
    <p style="font-family:system-ui,sans-serif;padding:16px;line-height:1.5">
      G2 側に <code>public/preview.png</code> を表示します（検証 2）。
      3D Viewer の「G2 向けプレビュー保存」で得た PNG を
      <code>hub-app/public/preview.png</code> にコピーしてから
      <code>npm run dev</code> を実行してください。
    </p>
  `;
}
