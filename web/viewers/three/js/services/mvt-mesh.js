/*!
 * PLATEAU MVT Research — JavaScript source module
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

import { tileBounds } from './web-tiles.js';
import { featureColor, isLandUseRoad } from '../../../../shared/mvt/feature-style.js';
import { mvtFeatureVertexCount } from '../../../../shared/mvt/mvt-feature-dedup.js';
import { classifyPolygonRings } from '../../../../shared/mvt/polygon-rings.js';
import {
  drapeBufferGeometryY,
  MVT_FLAT_Y,
  MVT_LUSE_DRAPE_OFFSET_M
} from './mvt-drape.js';

function lonLatToLocal(lon, lat, origin, metersPerDegLon, metersPerDegLat) {
  return {
    x: (lon - origin.lon) * metersPerDegLon,
    y: 1.5,
    z: -(lat - origin.lat) * metersPerDegLat
  };
}

function tileCoordToLonLat(p, tileX, tileY, zoom, extent, bounds) {
  const lon = bounds.west + (p.x / extent) * (bounds.east - bounds.west);
  const lat = bounds.north - (p.y / extent) * (bounds.north - bounds.south);
  return { lon, lat };
}

function tileClippingPlanes(THREE, bounds, origin, metersPerDegLon, metersPerDegLat) {
  const west = (bounds.west - origin.lon) * metersPerDegLon;
  const east = (bounds.east - origin.lon) * metersPerDegLon;
  const north = -(bounds.north - origin.lat) * metersPerDegLat;
  const south = -(bounds.south - origin.lat) * metersPerDegLat;
  return [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -west),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), east),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), -north),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), south)
  ];
}

/**
 * @param {{ sampleLocalY?: (lat: number, lon: number) => number | null | undefined }} [drape]
 */
export function buildTileGroup(THREE, features, tileX, tileY, zoom, origin, options, extent, drape) {
  const group = new THREE.Group();
  group.name = `mvt-${zoom}-${tileX}-${tileY}`;
  const bounds = tileBounds(tileX, tileY, zoom);
  const latRad = (origin.lat * Math.PI) / 180;
  const metersPerDegLat = 111_320;
  const metersPerDegLon = 111_320 * Math.cos(latRad);
  // MVT geometry normally includes a buffer outside the tile extent. Map renderers
  // clip that buffer at the tile boundary; without clipping, translucent polygons
  // from adjacent tiles overlap and make the seam look darker.
  const clippingPlanes = tileClippingPlanes(
    THREE, bounds, origin, metersPerDegLon, metersPerDegLat
  );
  const fillMaterials = new Map();
  const lineMaterials = new Map();
  const fillMaterialFor = (color, opacity) => {
    const key = `${color}:${opacity}`;
    if (!fillMaterials.has(key)) {
      fillMaterials.set(key, new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
        clippingPlanes,
        side: THREE.DoubleSide
      }));
    }
    return fillMaterials.get(key);
  };
  const lineMaterialFor = (color, opacity) => {
    const key = `${color}:${opacity}`;
    if (!lineMaterials.has(key)) {
      lineMaterials.set(key, new THREE.LineBasicMaterial({
        color,
        clippingPlanes,
        transparent: opacity < 1,
        opacity
      }));
    }
    return lineMaterials.get(key);
  };
  const lineBuckets = new Map();

  for (const feature of features) {
    const color = featureColor(options.id, feature.properties, options.color);
    const geom = feature.geometry;
    if (!geom?.length) continue;
    if (feature.type === 1) continue;
    if (feature.type === 2) {
      let bucket = lineBuckets.get(color);
      if (!bucket) {
        bucket = [];
        lineBuckets.set(color, bucket);
      }
      for (const line of geom) {
        if (line.length < 2) continue;
        let prev = null;
        for (const p of line) {
          const { lon, lat } = tileCoordToLonLat(p, tileX, tileY, zoom, extent, bounds);
          const local = lonLatToLocal(lon, lat, origin, metersPerDegLon, metersPerDegLat);
          if (prev) {
            bucket.push(prev.x, prev.y, prev.z, local.x, local.y, local.z);
          }
          prev = local;
        }
      }
      continue;
    }
    if (feature.type === 3) {
      const parts = classifyPolygonRings(geom);
      for (const partRings of parts) {
        const outer = partRings[0];
        if (!outer?.length) continue;
        const outerLonLat = [];
        const shape = new THREE.Shape();
        outer.forEach((p, idx) => {
          const { lon, lat } = tileCoordToLonLat(p, tileX, tileY, zoom, extent, bounds);
          outerLonLat.push([lon, lat]);
          const local = lonLatToLocal(lon, lat, origin, metersPerDegLon, metersPerDegLat);
          if (idx === 0) shape.moveTo(local.x, local.z);
          else shape.lineTo(local.x, local.z);
        });
        const holesLonLat = [];
        for (let r = 1; r < partRings.length; r += 1) {
          const hole = new THREE.Path();
          const holeLonLat = [];
          partRings[r].forEach((p, idx) => {
            const { lon, lat } = tileCoordToLonLat(p, tileX, tileY, zoom, extent, bounds);
            holeLonLat.push([lon, lat]);
            const local = lonLatToLocal(lon, lat, origin, metersPerDegLon, metersPerDegLat);
            if (idx === 0) hole.moveTo(local.x, local.z);
            else hole.lineTo(local.x, local.z);
          });
          if (holeLonLat.length >= 3) holesLonLat.push(holeLonLat);
          shape.holes.push(hole);
        }
        const shapeGeom = new THREE.ShapeGeometry(shape);
        // Shape の Y にローカル Z を入れているため、+90°で XZ 平面へ倒す。
        // -90°では Z が反転し、地形（X=東、Z=南）と鏡像になってしまう。
        shapeGeom.rotateX(Math.PI / 2);
        shapeGeom.translate(0, MVT_FLAT_Y, 0);
        const luseDrape = options.id === 'luse-2025' && drape?.sampleLocalY;
        if (luseDrape) {
          drapeBufferGeometryY(
            shapeGeom,
            origin,
            metersPerDegLon,
            metersPerDegLat,
            drape.sampleLocalY,
            MVT_LUSE_DRAPE_OFFSET_M
          );
        }
        const fillOpacity =
          options.id === 'luse-2025' && isLandUseRoad(feature.properties)
            ? (options.roadFillOpacity ?? options.opacity)
            : options.opacity;
        const mesh = new THREE.Mesh(shapeGeom, fillMaterialFor(color, fillOpacity).clone());
        mesh.userData.mvtPick = {
          datasetId: options.id,
          properties: { ...feature.properties },
          vertices: mvtFeatureVertexCount(feature),
          footprint: { outer: outerLonLat, holes: holesLonLat }
        };
        group.add(mesh);
      }
    }
  }

  for (const [color, positions] of lineBuckets) {
    if (positions.length < 6) continue;
    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    group.add(new THREE.LineSegments(lineGeom, lineMaterialFor(color, options.opacity)));
  }

  return group;
}

export function disposeObject3D(object) {
  object.traverse(node => {
    if (node.geometry) node.geometry.dispose();
    if (node.material) {
      if (Array.isArray(node.material)) node.material.forEach(m => m.dispose());
      else node.material.dispose();
    }
  });
}
