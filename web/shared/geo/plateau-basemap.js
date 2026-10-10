/** 2D / 3D 地表ラスタ（ちずうつし textureType と対応） */

export const PLATEAU_ORTHO_2023 = Object.freeze({
  id: 'plateau-ortho-2023',
  textureType: 'plateau-ortho-2023',
  label: 'PLATEAU Ortho 2023',
  tiles: ['https://tile.plateauview.mlit.go.jp/tiles/plateau-ortho-2023/{z}/{x}/{y}.png'],
  tileSize: 256,
  minzoom: 2,
  maxzoom: 18,
  attribution:
    '<a href="https://plateauview.mlit.go.jp/" target="_blank" rel="noopener">PLATEAU View</a> Ortho 2023'
});

export const GSI_STANDARD = Object.freeze({
  id: 'gsi-standard',
  textureType: 'standard',
  label: '地理院 標準地図',
  tiles: ['https://maps.gsi.go.jp/xyz/std/{z}/{x}/{y}.png'],
  tileSize: 256,
  minzoom: 2,
  maxzoom: 18,
  attribution:
    '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a>'
});

export const GSI_SEAMLESS_PHOTO = Object.freeze({
  id: 'gsi-seamlessphoto',
  textureType: 'photo',
  label: '地理院 航空写真',
  tiles: ['https://maps.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg'],
  tileSize: 256,
  minzoom: 2,
  maxzoom: 18,
  attribution:
    '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">国土地理院</a> シームレス写真'
});

/** @type {readonly [typeof GSI_STANDARD, typeof GSI_SEAMLESS_PHOTO, typeof PLATEAU_ORTHO_2023]} */
export const BASEMAP_CATALOG = Object.freeze([
  GSI_STANDARD,
  GSI_SEAMLESS_PHOTO,
  PLATEAU_ORTHO_2023
]);

export const DEFAULT_BASEMAP = PLATEAU_ORTHO_2023;

/** ちずうつし terrain.js の textureType 値 */
export const TERRAIN_TEXTURE_PLATEAU_ORTHO_2023 = 'plateau-ortho-2023';

export function basemapById(id) {
  return BASEMAP_CATALOG.find(item => item.id === id) ?? DEFAULT_BASEMAP;
}

export function basemapByTextureType(textureType) {
  return (
    BASEMAP_CATALOG.find(item => item.textureType === textureType) ?? DEFAULT_BASEMAP
  );
}
