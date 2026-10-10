/*!
 * PLATEAU MVT Research — TypeScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: /legal/SOURCE-CODE-LICENSE.txt
 */

import { resolveAddressAtLonLat } from '../../../../../shared/geo/address-resolve.js';
import type { GeoFix } from './geo-fix.js';

export type AddressSessionState = {
  addressLabel: string | null;
  addressPending: boolean;
  elevationM: number | null;
};

export class AddressSession {
  private addressLabel: string | null = null;
  private addressPending = false;
  private elevationM: number | null = null;
  private resolveGen = 0;
  private onChange: (() => void) | null = null;

  setOnChange(fn: () => void) {
    this.onChange = fn;
  }

  getState(): AddressSessionState {
    return {
      addressLabel: this.addressLabel,
      addressPending: this.addressPending,
      elevationM: this.elevationM
    };
  }

  noteFix(fix: GeoFix) {
    this.scheduleResolve(fix);
  }

  private scheduleResolve(fix: GeoFix) {
    const gen = ++this.resolveGen;
    this.addressPending = true;
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
  }
}
