/** モバイル WebView — Even シミュレータ風（黒地・グリーン） */

export const G2_PHONE_THEME = {
  bgRoot: '#050806',
  bgPanel: '#0a0c0e',
  bgMock: '#000000',
  border: '#1e3a2f',
  textPrimary: '#8fd4a8',
  textSecondary: '#6b9b7a',
  textMuted: '#4a7a5c',
  /** WebGL が緑系のため軽い仕上げのみ */
  mapFilter: 'brightness(0.94) contrast(1.14) saturate(1.2)'
} as const;
