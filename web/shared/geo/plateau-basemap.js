/** PLATEAU View オルソ（2D / 3D 地表テクスチャ共通） */

export const PLATEAU_ORTHO_2023 = Object.freeze({
  id: 'plateau-ortho-2023',
  label: 'PLATEAU Ortho 2023',
  tiles: ['https://tile.plateauview.mlit.go.jp/tiles/plateau-ortho-2023/{z}/{x}/{y}.png'],
  tileSize: 256,
  minzoom: 2,
  maxzoom: 18,
  attribution:
    '<a href="https://plateauview.mlit.go.jp/" target="_blank" rel="noopener">PLATEAU View</a> Ortho 2023'
});

/** ちずうつし terrain.js の textureType 値 */
export const TERRAIN_TEXTURE_PLATEAU_ORTHO_2023 = 'plateau-ortho-2023';
