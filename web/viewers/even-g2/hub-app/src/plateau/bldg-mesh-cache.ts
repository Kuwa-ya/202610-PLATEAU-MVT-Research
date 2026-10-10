import type { GeoJsonFeatureCollection } from './geojson-types.js';
import { bldgGeoJsonUrl } from './bldg-url.js';
import { fetchBldgFeatureCollection } from './fetch-geojson.js';
import type { RegionalMeshBounds } from './mesh-code.js';
import { regionalBldgMeshKey, shouldFetchRegionalBldg } from './mesh-data-key.js';
import { regionalMesh11Neighbors3x3, unionMeshBounds } from './mesh-neighbors.js';

export type MeshCacheSnapshot = {
  meshCode: string;
  tileCount: number;
  collection: GeoJsonFeatureCollection;
  bounds: RegionalMeshBounds;
};

function mergeCollections(collections: GeoJsonFeatureCollection[]): GeoJsonFeatureCollection {
  const features = collections.flatMap(c => c.features ?? []);
  return { type: 'FeatureCollection', features };
}

export class BldgMeshCache {
  private centerMeshCode: string | null = null;
  private tileCodes: string[] = [];
  private collection: GeoJsonFeatureCollection | null = null;
  private bounds: RegionalMeshBounds | null = null;

  get loadedMeshKey(): string | null {
    return this.centerMeshCode;
  }

  needsFetch(latitude: number, longitude: number): boolean {
    return shouldFetchRegionalBldg(this.centerMeshCode, latitude, longitude);
  }

  snapshot(): MeshCacheSnapshot | null {
    if (!this.centerMeshCode || !this.collection || !this.bounds) return null;
    return {
      meshCode: this.centerMeshCode,
      tileCount: this.tileCodes.length,
      collection: this.collection,
      bounds: this.bounds
    };
  }

  async ensure(latitude: number, longitude: number, signal?: AbortSignal): Promise<{ fetched: boolean; geoFetchMs: number }> {
    const centerMeshCode = regionalBldgMeshKey(latitude, longitude);
    if (this.centerMeshCode === centerMeshCode && this.collection) {
      return { fetched: false, geoFetchMs: 0 };
    }
    const tileCodes = regionalMesh11Neighbors3x3(latitude, longitude);
    const geoStart = performance.now();
    const collections = await Promise.all(
      tileCodes.map(code => fetchBldgFeatureCollection(bldgGeoJsonUrl(code), signal))
    );
    const geoFetchMs = performance.now() - geoStart;
    this.centerMeshCode = centerMeshCode;
    this.tileCodes = tileCodes;
    this.collection = mergeCollections(collections);
    this.bounds = unionMeshBounds(tileCodes);
    return { fetched: true, geoFetchMs };
  }
}
