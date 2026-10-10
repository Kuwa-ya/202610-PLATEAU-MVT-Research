const DEG_TO_RAD = Math.PI / 180;

/** 0=北、時計回り（度） */
export function initialBearingDeg(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number
): number {
  const lat1 = fromLat * DEG_TO_RAD;
  const lat2 = toLat * DEG_TO_RAD;
  const dLon = (toLon - fromLon) * DEG_TO_RAD;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2)
    - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const deg = Math.atan2(y, x) / DEG_TO_RAD;
  return ((deg % 360) + 360) % 360;
}
