import {
  VIEW_MIN_HEADING_DEG,
  VIEW_MIN_MOVE_M,
  VIEW_REFRESH_MS
} from '../config/defaults.js';
import type { GeoFix } from '../geo/geo-fix.js';
import type { HeadingSession } from '../geo/heading-session.js';
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
  headingDeg: number;
  dataFetched: boolean;
};

type LastPresent = {
  lat: number;
  lon: number;
  headingDeg: number;
  meshKey: string;
};

export class ViewPresenter {
  private readonly cache = new BldgMeshCache();
  private readonly hooks: PresentHooks;
  private readonly heading: HeadingSession;
  private readonly getFix: () => GeoFix | null;
  private readonly width: number;
  private readonly height: number;
  private last: LastPresent | null = null;
  private inFlight = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    heading: HeadingSession,
    getFix: () => GeoFix | null,
    size: { width: number; height: number },
    hooks: PresentHooks
  ) {
    this.heading = heading;
    this.getFix = getFix;
    this.width = size.width;
    this.height = size.height;
    this.hooks = hooks;
  }

  noteFix(fix: GeoFix) {
    if (fix.headingDeg != null && Number.isFinite(fix.headingDeg)) {
      this.heading.applyFromGeolocation(fix.headingDeg);
    }
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

    const latitude = fix?.latitude ?? 0;
    const longitude = fix?.longitude ?? 0;
    const headingDeg = this.heading.getHeadingDeg();
    const meshKey = regionalBldgMeshKey(latitude, longitude);

    if (!force && this.last) {
      const moveM = haversineMeters(this.last.lat, this.last.lon, latitude, longitude);
      const headDelta = Math.abs(headingDeg - this.last.headingDeg);
      const headWrap = Math.min(headDelta, 360 - headDelta);
      if (
        meshKey === this.last.meshKey
        && moveM < VIEW_MIN_MOVE_M
        && headWrap < VIEW_MIN_HEADING_DEG
      ) {
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
        headingDeg,
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
        headingDeg,
        dataFetched: fetched
      });

      this.last = { lat: latitude, lon: longitude, headingDeg, meshKey };
      return sample;
    } finally {
      this.inFlight = false;
    }
  }
}
