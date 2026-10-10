export type ResolvedAddress = {
  label: string;
  cityCode: string;
  level: 'chome' | 'city' | null;
};

export function resolveAddressAtLonLat(
  latitude: number,
  longitude: number
): Promise<ResolvedAddress | null>;

export function resetAddressCache(): void;
