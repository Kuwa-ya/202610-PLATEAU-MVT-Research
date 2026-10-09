import { endpointUrl } from "./clientConfig.js?v=20260917-2";

const GEOJSON_TYPES = Object.freeze([
  "building",
  "road",
  "use_district",
  "height_control_district",
  "fire_prevention_district",
  "land_use",
  "district_plan",
]);

function isFeatureCollection(value) {
  return value && typeof value === "object" && value.type === "FeatureCollection" && Array.isArray(value.features);
}

export class DevegokkoApiClient {
  constructor({ fetchImpl, config }) {
    if (!config) throw new Error("API設定が指定されていません。");
    this.fetchImpl = fetchImpl;
    this.config = config;
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
  }

  getAuthState() {
    return { authenticated: Boolean(this.accessToken), user: this.user };
  }

  getAddressApiKey() {
    return String(this.config.address?.api_key ?? "");
  }

  async login(email, password) {
    this.#clearAuth();
    const body = await this.#requestJson(
      endpointUrl(this.config.auth, this.config.auth.rest.endpoint, this.config.auth.rest.login),
      { method: "POST", body: { email: String(email ?? "").trim(), password: String(password ?? "") } },
    );
    if (!body?.access_token) throw new Error("ログイン応答に access_token がありません。");
    this.accessToken = body.access_token;
    this.refreshToken = body.refresh_token ?? null;
    this.user = body.user ?? { email: String(email ?? "").trim() };
    return this.getAuthState();
  }

  async logout() {
    if (this.refreshToken) {
      try {
        await this.#requestJson(
          endpointUrl(this.config.auth, this.config.auth.rest.endpoint, this.config.auth.rest.logout),
          { method: "POST", body: { refresh_token: this.refreshToken }, allowEmpty: true },
        );
      } finally {
        this.#clearAuth();
      }
    } else {
      this.#clearAuth();
    }
  }

  async fetchGeoJsonByPoint({ lon, lat, types = GEOJSON_TYPES }) {
    const normalizedTypes = normalizeTypes(types);
    const body = await this.#authorizedJson(
      endpointUrl(this.config.geojson, this.config.geojson.rest.endpoint, this.config.geojson.rest.pick_by_point),
      { method: "POST", body: { lon: Number(lon), lat: Number(lat), types: normalizedTypes } },
    );
    if (!isFeatureCollection(body)) throw new Error("GeoJSON API の応答が FeatureCollection ではありません。");
    return body;
  }

  async fetchGeoJsonByRect({ north, east, west, south, types = GEOJSON_TYPES }) {
    const normalizedTypes = normalizeTypes(types);
    const body = await this.#authorizedJson(
      endpointUrl(this.config.geojson, this.config.geojson.rest.endpoint, this.config.geojson.rest.clip_by_rect),
      {
        method: "POST",
        body: { n: Number(north), e: Number(east), w: Number(west), s: Number(south), types: normalizedTypes },
      },
    );
    if (!isFeatureCollection(body)) throw new Error("GeoJSON API の応答が FeatureCollection ではありません。");
    return body;
  }

  async fetchGeoJsonByMesh({ meshCode, bounds, types = GEOJSON_TYPES }) {
    if (!bounds) throw new Error("選択した地域メッシュの範囲を取得できません。");
    // 地域メッシュは中心点ではなく、メッシュの矩形全体を取得する。
    return this.fetchGeoJsonByRect({
      north: bounds.north,
      east: bounds.east,
      west: bounds.west,
      south: bounds.south,
      types,
    });
  }

  async geocodeAddress({ address }) {
    const key = this.getAddressApiKey().trim();
    if (!key) throw new Error("住所APIキーが未設定です。設定欄に入力してください。");
    const text = String(address ?? "").trim();
    if (!text) throw new Error("住所を入力してください。");
    const body = await this.#requestJson(
      endpointUrl(this.config.address, this.config.address.rest.endpoint, this.config.address.rest.geocode),
      {
        method: "POST",
        headers: { "X-Address-Api-Key": key },
        body: { address: text, format: "geojson" },
      },
    );
    if (!isFeatureCollection(body)) throw new Error("住所APIの応答が FeatureCollection ではありません。");
    return body;
  }

  async #authorizedJson(url, options) {
    if (!this.accessToken) throw new Error("先にIDとパスワードでログインしてください。");
    try {
      return await this.#requestJson(url, { ...options, headers: { Authorization: `Bearer ${this.accessToken}`, ...(options.headers ?? {}) } });
    } catch (error) {
      if (error?.status !== 401 || !this.refreshToken) throw error;
      await this.#refresh();
      return this.#requestJson(url, { ...options, headers: { Authorization: `Bearer ${this.accessToken}`, ...(options.headers ?? {}) } });
    }
  }

  async #refresh() {
    const body = await this.#requestJson(
      endpointUrl(this.config.auth, this.config.auth.rest.endpoint, this.config.auth.rest.refresh),
      { method: "POST", body: { refresh_token: this.refreshToken } },
    );
    this.accessToken = body?.access_token ?? null;
    this.refreshToken = body?.refresh_token ?? this.refreshToken;
    this.user = body?.user ?? this.user;
    if (!this.accessToken) throw new Error("アクセストークンを更新できませんでした。");
  }

  async #requestJson(url, { method = "GET", headers = {}, body, allowEmpty = false } = {}) {
    let response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        cache: "no-store",
      });
    } catch (error) {
      throw new Error(`APIへ接続できませんでした。CORS設定またはAPI URLを確認してください。(${url})`, { cause: error });
    }
    if (allowEmpty && response.status === 204) return null;
    let payload = null;
    try { payload = await response.json(); } catch { /* empty/non-JSON error body */ }
    if (!response.ok) {
      const detail = payload?.error ?? payload?.code ?? `HTTP ${response.status}`;
      const error = new Error(`API取得に失敗しました: ${detail}`);
      error.status = response.status;
      error.code = payload?.code;
      throw error;
    }
    return payload;
  }

  #clearAuth() {
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
  }
}

function normalizeTypes(types) {
  const allowed = new Set(GEOJSON_TYPES);
  const selected = [...new Set((Array.isArray(types) ? types : []).map(String).filter((type) => allowed.has(type)))];
  if (!selected.length) throw new Error("取得対象のGeoJSON種別を1つ以上選択してください。");
  return selected;
}

export { GEOJSON_TYPES };
