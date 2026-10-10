import { VIEW_MIN_MOVE_M, VIEW_MOVE_ARROW_MIN_M, VIEW_REFRESH_MS } from '../config/defaults.js';
import type { GeoFix } from '../geo/geo-fix.js';
import { initialBearingDeg } from '../geo/bearing.js';
import { haversineMeters } from '../geo/haversine.js';
import type { FrameSample, FrameTrigger } from '../metrics/frame-metrics.js';
import { BldgMeshCache } from '../plateau/bldg-mesh-cache.js';
import { renderCachedBldgFrame } from '../plateau/building-frame.js';
import { regionalBldgMeshKey } from '../plateau/mesh-data-key.js';

export type PresentHooks = {
  onFrame: (sample: FrameSample, detail: PresentDetail) => void | Promise<void>;
};

export type PresentDetail = {
  bytes: Uint8Array;
  meshCode: string;
  featureCount: number;
  ringCount: number;
  geoFetchMs: number;
  renderMs: number;
  /** 直前フレームからの移動方位（null=静止） */
  movementBearingDeg: number | null;
  dataFetched: boolean;
};

type LastPresent = {
  lat: number;
  lon: number;
  meshKey: string;
};

export class ViewPresenter {
  private readonly cache = new BldgMeshCache();
  private readonly hooks: PresentHooks;
  private readonly getFix: () => GeoFix | null;
  private readonly width: number;
  private readonly height: number;
  private last: LastPresent | null = null;
  private inFlight = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    getFix: () => GeoFix | null,
    size: { width: number; height: number },
    hooks: PresentHooks
  ) {
    this.getFix = getFix;
    this.width = size.width;
    this.height = size.height;
    this.hooks = hooks;
  }

  noteFix(fix: GeoFix) {
    if (this.cache.needsFetch(fix.latitude, fix.longitude)) {
      this.present('gps', true).catch(console.error);
    }
  }

  start() {
    this.timer = setInterval(() => {
      this.present('tick').catch(console.error);
    }, VIEW_REFRESH_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async present(trigger: FrameTrigger, force = false): Promise<FrameSample | null> {
    if (this.inFlight) return null;
    const fix = this.getFix();
    if (!fix) return null;

    const latitude = fix.latitude;
    const longitude = fix.longitude;
    const meshKey = regionalBldgMeshKey(latitude, longitude);

    let movementBearingDeg: number | null = null;
    if (this.last) {
      const moveM = haversineMeters(this.last.lat, this.last.lon, latitude, longitude);
      if (moveM >= VIEW_MOVE_ARROW_MIN_M) {
        movementBearingDeg = initialBearingDeg(this.last.lat, this.last.lon, latitude, longitude);
      }
      if (!force && meshKey === this.last.meshKey && moveM < VIEW_MIN_MOVE_M) {
        return null;
      }
    }

    this.inFlight = true;
    const totalStart = performance.now();
    try {
      const { fetched, geoFetchMs } = await this.cache.ensure(latitude, longitude);
      const fetchMs = fetched ? geoFetchMs : 0;
      const snap = this.cache.snapshot();
      if (!snap) return null;

      const built = await renderCachedBldgFrame({
        meshCode: snap.meshCode,
        collection: snap.collection,
        bounds: snap.bounds,
        latitude,
        longitude,
        movementBearingDeg,
        width: this.width,
        height: this.height
      });

      const sample: FrameSample = {
        at: new Date().toISOString(),
        bytes: built.bytes.byteLength,
        fetchMs,
        sdkMs: 0,
        totalMs: performance.now() - totalStart,
        sdkResult: 'pending',
        trigger
      };

      await this.hooks.onFrame(sample, {
        bytes: built.bytes,
        meshCode: built.meshCode,
        featureCount: built.featureCount,
        ringCount: built.ringCount,
        geoFetchMs: fetched ? geoFetchMs : 0,
        renderMs: built.renderMs,
        movementBearingDeg,
        dataFetched: fetched
      });

      this.last = { lat: latitude, lon: longitude, meshKey };
      return sample;
    } finally {
      this.inFlight = false;
    }
  }
}
