export const CLIENT_CONFIG_URL = "https://www.kuwa-ya.co.jp/app/devegokko_v3_config.json";

function isLocalDevelopment() {
  const hostname = globalThis.location?.hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function validateConfig(config) {
  for (const block of ["auth", "geojson", "address"]) {
    if (!config?.[block]?.url || !config?.[block]?.rest?.endpoint) {
      throw new Error(`設定JSONの ${block} ブロックが不正です。`);
    }
  }
  if (!config.address.api_key) throw new Error("設定JSONに address.api_key がありません。");
  return config;
}

/** 指定された公開設定JSONだけを読み込む。 */
export async function loadClientConfig(fetchImpl) {
  // localhostでは設定JSONも同一オリジンの開発プロキシから取得する。
  const url = isLocalDevelopment() ? "/devegokko-config.json" : CLIENT_CONFIG_URL;
  const response = await fetchImpl(url, { cache: "no-store", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`設定JSONを取得できませんでした: HTTP ${response.status}`);
  const config = validateConfig(await response.json());

  // APIのパス・認証方式・キーは設定JSONを使い、localhostでは通信先だけ同一オリジンへ置き換える。
  if (isLocalDevelopment()) {
    const proxyUrl = `${globalThis.location.origin}/devegokko-api`;
    for (const block of ["auth", "geojson", "address"]) config[block] = { ...config[block], url: proxyUrl };
  }
  return config;
}

/** 設定JSONのブロックとRESTパスからURLを組み立てる。 */
export function endpointUrl(block, ...parts) {
  const base = String(block?.url ?? "").replace(/\/+$/, "");
  return [base, ...parts]
    .map((part) => String(part ?? "").replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
}
