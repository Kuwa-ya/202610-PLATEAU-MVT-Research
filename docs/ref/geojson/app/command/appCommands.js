/**
 * 【役割】View が発火する「操作名」を、ViewModel のメソッド呼び出しへ変換するコマンド辞書。
 * 【レイヤ】Command
 * 【依存】`AppViewModel`（型/実体）
 * 【公開】`createAppCommands(vm)` / `dispatch(commands, name, payload)`
 * 【補足】ここはルーティング表。状態は持たず、ロジックは最小（引数整形まで）。
 */
export function createAppCommands(vm) {
  return {
    setActiveTab: (tabId) => vm.setActiveTab(tabId),

    loadUrl: (url) => vm.loadUrl(url),
    loadLocal: (file) => vm.loadLocal(file),
    // backwards compatibility (old name)
    loadZip: (file) => vm.loadLocal(file),

    clearLoadedData: () => vm.clearAllLayers(),

    setBasemapEnabled: (enabled) => vm.setBasemapEnabled(enabled),
    setBasemapType: (type) => vm.setBasemapType(type),
    setMeshEnabled: (enabled) => vm.setMeshEnabled(enabled),
    setWebTileEnabled: (enabled) => vm.setWebTileEnabled(enabled),
    setWebTileState: (payload) => vm.setWebTileState(payload),
    setMeshState: (payload) => vm.setMeshState(payload),
    selectMesh: (meshCode) => vm.selectMesh(meshCode),
    loadSelectedMesh: (payload) => vm.loadSelectedMesh(payload),

    login: (payload) => vm.login(payload?.email, payload?.password),
    logout: () => vm.logout(),
    searchAddress: (payload) => vm.searchAddress(payload),

    applyFilter: (params) => vm.applyFilter(params),
    clearFilter: () => vm.clearFilter(),

    applyColor: (params) => vm.applyColor(params),
    clearColor: () => vm.clearColor(),

    setLayerVisible: (payload) => vm.setLayerVisible(payload?.layerId, payload?.visible),
    moveLayerUp: (layerId) => vm.moveLayerUp(layerId),
    moveLayerDown: (layerId) => vm.moveLayerDown(layerId),
    removeLayer: (layerId) => vm.removeLayer(layerId),
    requestZoomToLayer: (layerId) => vm.requestZoomToLayer(layerId),

    selectMapFeature: (payload) => vm.selectMapFeature(payload?.layerId, payload?.feature),
    clearMapZoomIntent: () => vm.clearMapZoomIntent(),

    setLabelSelection: (payload) => vm.setLabelSelection(payload),
    clearLabel: () => vm.clearLabel(),
  };
}

/**
 * 【役割】名前でコマンドを実行する共通入口（View はこれだけ知ればよい）。
 * @param {Record<string, (payload:any)=>any>} commands
 * @param {string} name
 * @param {any} payload
 */
export function dispatch(commands, name, payload) {
  return commands[name]?.(payload);
}

