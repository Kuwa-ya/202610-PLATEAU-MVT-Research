/** 配信パス — Even G2 pack は `base: './'` → `data/address/` */

let cached;

export function getAddressDataBase() {
  if (cached) return cached;
  if (typeof process !== 'undefined' && process.env?.ADDRESS_DATA_BASE) {
    cached = process.env.ADDRESS_DATA_BASE.replace(/\/$/, '');
    return cached;
  }
  const viteBase =
    typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL;
  if (viteBase === './' && typeof document !== 'undefined' && document.baseURI) {
    cached = new URL('data/address/', document.baseURI).href.replace(/\/$/, '');
    return cached;
  }
  cached = '/data/address';
  return cached;
}
