import { tileBounds } from './web-tiles.js';
import { featureColor } from './mvt-style.js';

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

export function buildTileGroup(THREE, features, tileX, tileY, zoom, origin, options, extent) {
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
  const fillMaterialFor = color => {
    if (!fillMaterials.has(color)) {
      fillMaterials.set(color, new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: options.opacity,
        depthWrite: false,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
        clippingPlanes,
        side: THREE.DoubleSide
      }));
    }
    return fillMaterials.get(color);
  };
  const lineMaterialFor = color => {
    if (!lineMaterials.has(color)) {
      lineMaterials.set(color, new THREE.LineBasicMaterial({ color, clippingPlanes }));
    }
    return lineMaterials.get(color);
  };

  for (const feature of features) {
    const color = featureColor(options.id, feature.properties, options.color);
    const geom = feature.geometry;
    if (!geom?.length) continue;
    if (feature.type === 1) continue;
    if (feature.type === 2) {
      for (const line of geom) {
        if (line.length < 2) continue;
        const pts = [];
        for (const p of line) {
          const { lon, lat } = tileCoordToLonLat(p, tileX, tileY, zoom, extent, bounds);
          const local = lonLatToLocal(lon, lat, origin, metersPerDegLon, metersPerDegLat);
          pts.push(local.x, local.y, local.z);
        }
        const lineGeom = new THREE.BufferGeometry();
        lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        group.add(new THREE.Line(lineGeom, lineMaterialFor(color)));
      }
      continue;
    }
    if (feature.type === 3) {
      const rings = geom;
      const outer = rings[0];
      if (!outer?.length) continue;
      const shape = new THREE.Shape();
      outer.forEach((p, idx) => {
        const { lon, lat } = tileCoordToLonLat(p, tileX, tileY, zoom, extent, bounds);
        const local = lonLatToLocal(lon, lat, origin, metersPerDegLon, metersPerDegLat);
        if (idx === 0) shape.moveTo(local.x, local.z);
        else shape.lineTo(local.x, local.z);
      });
      for (let r = 1; r < rings.length; r += 1) {
        const hole = new THREE.Path();
        rings[r].forEach((p, idx) => {
          const { lon, lat } = tileCoordToLonLat(p, tileX, tileY, zoom, extent, bounds);
          const local = lonLatToLocal(lon, lat, origin, metersPerDegLon, metersPerDegLat);
          if (idx === 0) hole.moveTo(local.x, local.z);
          else hole.lineTo(local.x, local.z);
        });
        shape.holes.push(hole);
      }
      const shapeGeom = new THREE.ShapeGeometry(shape);
      // Shape の Y にローカル Z を入れているため、+90°で XZ 平面へ倒す。
      // -90°では Z が反転し、地形（X=東、Z=南）と鏡像になってしまう。
      shapeGeom.rotateX(Math.PI / 2);
      shapeGeom.translate(0, 1.2, 0);
      group.add(new THREE.Mesh(shapeGeom, fillMaterialFor(color)));
    }
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
