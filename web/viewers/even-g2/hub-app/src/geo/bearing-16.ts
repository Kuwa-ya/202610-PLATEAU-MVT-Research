/*!
 * PLATEAU MVT Research — TypeScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: /legal/SOURCE-CODE-LICENSE.txt
 */

/** 0°=北、時計回り。16 方位（日本語）。 */
const BEARING_16_JA = [
  '北',
  '北北東',
  '北東',
  '東北東',
  '東',
  '東南東',
  '南東',
  '南南東',
  '南',
  '南南西',
  '南西',
  '西南西',
  '西',
  '西北西',
  '北西',
  '北北西'
] as const;

export function bearing16LabelFromDeg(bearingDeg: number): string {
  const normalized = ((bearingDeg % 360) + 360) % 360;
  const index = Math.floor(((normalized + 11.25) % 360) / 22.5) % 16;
  return BEARING_16_JA[index] ?? '—';
}
