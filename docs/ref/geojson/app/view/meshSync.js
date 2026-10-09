export function syncMeshLayer(map, meshState, onSelect) {
  map.syncMeshLayer({ ...meshState, onSelect });
}
export function syncWebTileLayer(map, tileState) { map.syncWebTileLayer(tileState); }
