export type GeoFix = {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  /** 進行方向（度・北=0、時計回り）。端末 GPS のみ */
  headingDeg?: number | null;
  at: string;
};

export function formatCoord(value: number, digits = 5): string {
  return value.toFixed(digits);
}

export function formatFixShort(fix: GeoFix): string {
  return `${formatCoord(fix.latitude, 4)},${formatCoord(fix.longitude, 4)}`;
}
