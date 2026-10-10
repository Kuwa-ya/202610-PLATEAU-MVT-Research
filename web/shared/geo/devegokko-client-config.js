/**
 * 公開設定 JSON（devegokko / ちずうつし系 API）
 * @see https://www.kuwa-ya.co.jp/app/devegokko_v3_config.json
 */

export const DEVEGOKKO_CLIENT_CONFIG_URL =
  'https://www.kuwa-ya.co.jp/app/devegokko_v3_config.json';

/** @param {unknown} config */
function validateAddressBlock(config) {
  const address = config?.address;
  if (!address?.url || !address?.rest?.endpoint || !address?.rest?.geocode) {
    throw new Error('設定JSONの address ブロックが不正です。');
  }
  if (!address.api_key) throw new Error('設定JSONに address.api_key がありません。');
  return address;
}

let cachedConfigPromise = null;

/** @returns {Promise<{ address: ReturnType<typeof validateAddressBlock> }>} */
export async function loadDevegokkoClientConfig(fetchImpl = fetch) {
  if (!cachedConfigPromise) {
    cachedConfigPromise = fetchImpl(DEVEGOKKO_CLIENT_CONFIG_URL, {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    })
      .then(async response => {
        if (!response.ok) {
          throw new Error(`設定JSONを取得できませんでした: HTTP ${response.status}`);
        }
        const config = await response.json();
        validateAddressBlock(config);
        return config;
      })
      .catch(error => {
        cachedConfigPromise = null;
        throw error;
      });
  }
  return cachedConfigPromise;
}

/** @param {{ url: string, rest: { endpoint: string, geocode: string } }} addressBlock */
export function addressGeocodeEndpointUrl(addressBlock) {
  const base = String(addressBlock.url).replace(/\/+$/, '');
  return [base, addressBlock.rest.endpoint, addressBlock.rest.geocode]
    .map(part => String(part).replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

export function isLocalDevelopmentHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}
