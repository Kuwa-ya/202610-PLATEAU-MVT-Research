/**
 * 【役割】2Dアプリのエントリポイント。依存生成と初期化順序を確定し、View を起動する。
 * 【レイヤ】Composition Root（DI/配線）
 * 【依存】Leaflet/JSZip（global）・`LeafletMapAdapter`・`BrowserDataGateway`・`AppViewModel`・`appCommands`・`AppView`
 * 【公開】なし（副作用でアプリ起動）
 * 【補足】ここだけが各レイヤを横断して import する。その他の層は一方向依存を維持する。
 */
import { AppView } from "./view/AppView.js?v=20260917-2";
import { LeafletMapAdapter } from "./services/LeafletMapAdapter.js?v=20260917-2";
import { BrowserDataGateway } from "./services/BrowserDataGateway.js?v=20260917-2";
import { DevegokkoApiClient } from "./services/DevegokkoApiClient.js?v=20260917-2";
import { loadClientConfig } from "./services/clientConfig.js?v=20260917-2";
import { AppViewModel } from "./viewmodel/AppViewModel.js?v=20260917-2";
import { createAppCommands } from "./command/appCommands.js?v=20260917-2";

/**
 * 動作: `index.html` で CDN 読み込み済みである前提で、Leaflet（`L`）と JSZip の存在を検証する。
 * 不足時は例外を投げ、起動処理を止める。
 */
function assertGlobals() {
  if (!globalThis.L) throw new Error("Leaflet (L) が読み込まれていません。");
  if (!globalThis.JSZip) throw new Error("JSZip が読み込まれていません。");
}

/**
 * 動作: 地図・データ取得・ViewModel を生成し、初期化後に Command と View を組み立てる。
 * 順序: 地図初期化 → ViewModel 初期化 → View 生成。
 * 末尾で `globalThis.__app` にデバッグ用参照を公開する。
 */
async function bootstrap() {
  assertGlobals();

  const map = new LeafletMapAdapter(globalThis.L, "map");
  map.initialize();

  const fetchImpl = globalThis.fetch.bind(globalThis);
  const dataSources = new BrowserDataGateway({
    fetchImpl,
    jszip: globalThis.JSZip,
  });

  let configError = null;
  try {
    const config = await loadClientConfig(fetchImpl);
    dataSources.setApiClient(new DevegokkoApiClient({ fetchImpl, config }));
  } catch (error) {
    configError = error;
  }

  const vm = new AppViewModel({ dataSources });
  await vm.initialize();
  if (configError) {
    vm.reportMessage("error", `API設定を読み込めませんでした。API機能のみ停止しています: ${configError.message}`);
  }

  const commands = createAppCommands(vm);
  const view = new AppView(document, vm, map, commands);
  commands.setMeshState(map.getMeshViewportState());
  commands.setWebTileState(map.getWebTileViewportState());

  globalThis.__app = { vm, view };
}

/**
 * 動作: `bootstrap` が失敗したとき、コンソールに出しつつ `#notifications` があればエラー通知を1件追加する。
 * View 未生成でもユーザーに気づけるようにするためのフォールバック。
 * @param {unknown} err
 */
function reportBootstrapFailure(err) {
  console.error(err);
  const el = document.getElementById("notifications");
  if (el) {
    const div = document.createElement("div");
    div.className = "notice notice--error";
    div.textContent = `起動に失敗しました: ${err?.message ?? String(err)}`;
    el.appendChild(div);
  }
}

bootstrap().catch(reportBootstrapFailure);
