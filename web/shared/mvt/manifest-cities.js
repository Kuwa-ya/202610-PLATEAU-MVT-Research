/** manifest.cities は同一 cityCode で複数行（用途地域のレイヤ種別など）があり得る */

export function manifestEntriesForCity(manifest, cityCode) {
  if (!manifest?.cities) return [];
  return manifest.cities.filter(city => city.cityCode === cityCode);
}
