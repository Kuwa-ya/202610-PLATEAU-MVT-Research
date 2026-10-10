/** スマホ WebView 用: G2 と同じ PNG を軽量プレビュー（Object URL） */
let objectUrl: string | null = null;
const listeners = new Set<() => void>();

export function setPhonePreviewPng(bytes: Uint8Array): void {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  objectUrl = URL.createObjectURL(new Blob([copy], { type: 'image/png' }));
  for (const listener of listeners) listener();
}

export function getPhonePreviewUrl(): string | null {
  return objectUrl;
}

export function subscribePhonePreview(listener: () => void): () => void {
  listeners.add(listener);
  listener();
  return () => listeners.delete(listener);
}
