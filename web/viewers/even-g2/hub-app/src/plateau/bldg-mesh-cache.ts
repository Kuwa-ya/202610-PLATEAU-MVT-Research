import type { GeoJsonFeatureCollection } from './geojson-types.js';
import { bldgGeoJsonUrl } from './bldg-url.js';
import { fetchBldgFeatureCollection } from './fetch-geojson.js';
import { meshBounds11 } from './mesh-code.js';
import { regionalBldgMeshKey, shouldFetchRegionalBldg } from './mesh-data-key.js';

export type MeshCacheSnapshot = {
  meshCode: string;
  collection: GeoJsonFeatureCollection;
  bounds: ReturnType<typeof meshBounds11>;
};

export class BldgMeshCache {
  private meshCode: string | null = null;
  private collection: GeoJsonFeatureCollection | null = null;
  private bounds: ReturnType<typeof meshBounds11> | null = null;

  get loadedMeshKey(): string | null {
    return this.meshCode;
  }

  needsFetch(latitude: number, longitude: number): boolean {
    return shouldFetchRegionalBldg(this.meshCode, latitude, longitude);
  }

  snapshot(): MeshCacheSnapshot | null {
    if (!this.meshCode || !this.collection || !this.bounds) return null;
    return {
      meshCode: this.meshCode,
      collection: this.collection,
      bounds: this.bounds
    };
  }

  async ensure(latitude: number, longitude: number, signal?: AbortSignal): Promise<{ fetched: boolean; geoFetchMs: number }> {
    const meshCode = regionalBldgMeshKey(latitude, longitude);
    if (this.meshCode === meshCode && this.collection) {
      return { fetched: false, geoFetchMs: 0 };
    }
    const geoStart = performance.now();
    const collection = await fetchBldgFeatureCollection(bldgGeoJsonUrl(meshCode), signal);
    const geoFetchMs = performance.now() - geoStart;
    this.meshCode = meshCode;
    this.collection = collection;
    this.bounds = meshBounds11(meshCode);
    return { fetched: true, geoFetchMs };
  }
}
