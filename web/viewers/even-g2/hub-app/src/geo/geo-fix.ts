export type GeoFix = {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  at: string;
};

export function formatCoord(value: number, digits = 5): string {
  return value.toFixed(digits);
}

export function formatFixShort(fix: GeoFix): string {
  return `${formatCoord(fix.latitude, 4)},${formatCoord(fix.longitude, 4)}`;
}
