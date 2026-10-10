/*!
 * PLATEAU MVT Research — TypeScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: /legal/SOURCE-CODE-LICENSE.txt
 *
 * ALL RIGHTS RESERVED. NO LICENSE IS GRANTED BY ACCESSING, VIEWING, OR COPYING THIS FILE.
 * THIS SOFTWARE AND ALL ASSOCIATED MATERIALS ARE PROPRIETARY TO KUWA-YA, LTD.
 * SOURCE CODE IS MADE PUBLICLY VIEWABLE ONLY FOR TRANSPARENCY AND INFORMATIONAL
 * PURPOSES. WITHOUT PRIOR WRITTEN PERMISSION FROM KUWA-YA, LTD., YOU MAY NOT USE,
 * COPY, REPRODUCE, MODIFY, ADAPT, TRANSLATE, CREATE DERIVATIVE WORKS FROM,
 * DISTRIBUTE, REDISTRIBUTE, PUBLISH, SUBLICENSE, SELL, RENT, LEASE, OR OTHERWISE
 * MAKE AVAILABLE ANY PART OF THIS SOFTWARE, OR USE IT FOR COMMERCIAL PURPOSES OR
 * TO DEVELOP OR PROVIDE ANY PRODUCT OR SERVICE. VIEWING DOES NOT GRANT ANY RIGHTS.
 * USE OF THE PUBLIC WEB APPLICATION IS GOVERNED BY ITS TERMS OF SERVICE ONLY AND
 * DOES NOT GRANT ANY RIGHT TO THIS SOURCE CODE. THE SOFTWARE IS PROVIDED "AS IS"
 * WITHOUT WARRANTY OF ANY KIND. SEE /legal/SOURCE-CODE-LICENSE.txt.
 */

import { VIEW_MIN_MOVE_M, VIEW_MOVE_ARROW_MIN_M, VIEW_REFRESH_MS } from '../config/defaults.js';
import type { GeoFix } from '../geo/geo-fix.js';
import { initialBearingDeg } from '../geo/bearing.js';
import { haversineMeters } from '../geo/haversine.js';
import type { FrameSample, FrameTrigger } from '../metrics/frame-metrics.js';
import { BldgMeshCache } from '../plateau/bldg-mesh-cache.js';
import { renderCachedBldgFrame } from '../plateau/building-frame.js';
import { regionalBldgMeshKey } from '../plateau/mesh-data-key.js';
import {
  fetchUseDistrictHighlight,
  type UseDistrictHighlight
} from '../plateau/use-district-highlight.js';

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
  /** 中心タップで用途地域表示 ON のとき */
  useDistrictSummary: string | null;
  useDistrictMiss: boolean;
  /** 取得失敗時の短い理由（G2 右パネル） */
  useDistrictHint: string | null;
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
  private useDistrictVisible = false;
  private useDistrictHighlight: UseDistrictHighlight | null = null;
  private useDistrictMiss = false;
  private useDistrictHint: string | null = null;
  private useDistrictAbort: AbortController | null = null;

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
    this.useDistrictAbort?.abort();
    this.useDistrictAbort = null;
  }

  /** 現在地（リング）タップ: 用途地域の表示／非表示を切り替え */
  async onUserRingTap(): Promise<void> {
    if (this.useDistrictVisible) {
      this.useDistrictVisible = false;
      this.useDistrictHighlight = null;
      this.useDistrictMiss = false;
      this.useDistrictHint = null;
      this.useDistrictAbort?.abort();
      this.useDistrictAbort = null;
      await this.present('tap', true);
      return;
    }

    const fix = this.getFix();
    if (!fix) return;

    this.useDistrictVisible = true;
    this.useDistrictAbort?.abort();
    const ac = new AbortController();
    this.useDistrictAbort = ac;
    try {
      this.useDistrictHighlight = await fetchUseDistrictHighlight(
        fix.latitude,
        fix.longitude,
        ac.signal
      );
      this.useDistrictMiss = !this.useDistrictHighlight;
      this.useDistrictHint = null;
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error('[use-district]', error);
      }
      this.useDistrictHighlight = null;
      this.useDistrictMiss = true;
      const msg = error instanceof Error ? error.message : String(error);
      this.useDistrictHint =
        /HTTP 404/.test(msg) ? '用途地域索引なし（再 pack）' : '用途地域取得失敗';
    } finally {
      if (this.useDistrictAbort === ac) this.useDistrictAbort = null;
    }
    await this.present('tap', true);
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
        useDistrictHighlight: this.useDistrictVisible ? this.useDistrictHighlight : null,
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
        dataFetched: fetched,
        useDistrictSummary:
          this.useDistrictVisible && this.useDistrictHighlight
            ? this.useDistrictHighlight.summary
            : null,
        useDistrictMiss: this.useDistrictVisible && this.useDistrictMiss,
        useDistrictHint: this.useDistrictVisible ? this.useDistrictHint : null
      });

      this.last = { lat: latitude, lon: longitude, meshKey };
      return sample;
    } finally {
      this.inFlight = false;
    }
  }
}
