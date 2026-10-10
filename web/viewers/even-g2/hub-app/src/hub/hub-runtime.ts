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
