/*!
 * PLATEAU MVT Research — TypeScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: /legal/SOURCE-CODE-LICENSE.txt
 */

import { resolveAddressAtLonLat } from '../../../../../shared/geo/address-resolve.js';
// @ts-expect-error shared JS
import { createGsiDemPointSampler } from '../../../../../shared/geo/gsi-dem-point-sampler.js';
import type { GeoFix } from './geo-fix.js';

const demSampler = createGsiDemPointSampler();

export type AddressSessionState = {
  addressLabel: string | null;
  addressPending: boolean;
  elevationM: number | null;
  elevationPending: boolean;
};

export class AddressSession {
  private addressLabel: string | null = null;
  private addressPending = false;
  private elevationM: number | null = null;
  private elevationPending = false;
  private resolveGen = 0;
  private onChange: (() => void) | null = null;

  setOnChange(fn: () => void) {
    this.onChange = fn;
  }

  getState(): AddressSessionState {
    return {
      addressLabel: this.addressLabel,
      addressPending: this.addressPending,
      elevationM: this.elevationM,
      elevationPending: this.elevationPending
    };
  }

  noteFix(fix: GeoFix) {
    this.scheduleResolve(fix);
  }

  private scheduleResolve(fix: GeoFix) {
    const gen = ++this.resolveGen;
    this.addressPending = true;
    this.elevationPending = true;
    this.onChange?.();

    void resolveAddressAtLonLat(fix.latitude, fix.longitude)
      .then(result => {
        if (gen !== this.resolveGen) return;
        this.addressPending = false;
        this.addressLabel = result?.label ?? null;
        this.onChange?.();
      })
      .catch(error => {
        if (gen !== this.resolveGen) return;
        console.warn('[address]', error);
        this.addressPending = false;
        this.addressLabel = null;
        this.onChange?.();
      });

    void demSampler
      .sample(fix.latitude, fix.longitude)
      .then((elev: number) => {
        if (gen !== this.resolveGen) return;
        this.elevationPending = false;
        this.elevationM = Number.isFinite(elev) ? elev : null;
        this.onChange?.();
      })
      .catch((error: unknown) => {
        if (gen !== this.resolveGen) return;
        console.warn('[elevation]', error);
        this.elevationPending = false;
        this.elevationM = null;
        this.onChange?.();
      });
  }
}
