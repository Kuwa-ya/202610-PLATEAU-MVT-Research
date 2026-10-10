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

import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';

export type EvenHubBridge = Awaited<ReturnType<typeof waitForEvenAppBridge>>;

export type HubRuntime =
  | { mode: 'even'; bridge: EvenHubBridge }
  | { mode: 'simulation'; reason: string };

const BRIDGE_WAIT_MS = 3_000;

function hubModeFromEnv(): 'simulation' | 'even' | 'auto' {
  const raw = import.meta.env.VITE_HUB_MODE as string | undefined;
  if (raw === 'simulation' || raw === 'even' || raw === 'auto') return raw;
  return 'auto';
}

/**
 * 開発: 既定は simulation（プレビューのみ、ブリッジ待ちで止まらない）。
 * 本番ビルド / VITE_HUB_MODE=even: Even Hub ブリッジを待つ。
 */
export async function resolveHubRuntime(): Promise<HubRuntime> {
  const mode = hubModeFromEnv();
  if (mode === 'simulation') {
    return { mode: 'simulation', reason: 'VITE_HUB_MODE=simulation' };
  }

  try {
    const bridge = await Promise.race([
      waitForEvenAppBridge(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Even bridge timeout')), BRIDGE_WAIT_MS);
      })
    ]);
    return { mode: 'even', bridge };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (mode === 'even') {
      console.error('[hub] Even bridge 必須ですが取得できません:', message);
    } else {
      console.warn('[hub] Even bridge なし → シミュレーション（プレビューのみ）:', message);
    }
    return { mode: 'simulation', reason: message };
  }
}
