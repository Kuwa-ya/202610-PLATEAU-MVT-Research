import * as THREE from 'three';
import type { BuildingVolume } from './geojson-buildings.js';
import type { RegionalMeshBounds } from './mesh-code.js';
import type { ObliqueRenderOptions } from './render-oblique.js';

const DEG_TO_RAD = Math.PI / 180;
const VIEW_ELEVATION_RAD = Math.PI / 4;
const METERS_PER_DEG_LAT = 111_320;

function lonLatToEn(
  lon: number,
  lat: number,
  userLon: number,
  userLat: number,
  pivotLat: number
): { east: number; north: number } {
  const cosLat = Math.cos(pivotLat * DEG_TO_RAD);
  return {
    east: (lon - userLon) * METERS_PER_DEG_LAT * cosLat,
    north: (lat - userLat) * METERS_PER_DEG_LAT
  };
}

function buildingMesh(building: BuildingVolume, pivotLat: number, userLon: number, userLat: number): THREE.Mesh {
  const shape = new THREE.Shape();
  const ring = building.outer;
  for (let i = 0; i < ring.length; i += 1) {
    const [lon, lat] = ring[i];
    const { east, north } = lonLatToEn(lon, lat, userLon, userLat, pivotLat);
    if (i === 0) shape.moveTo(east, north);
    else shape.lineTo(east, north);
  }
  shape.closePath();

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: building.heightM,
    bevelEnabled: false
  });
  geom.rotateX(-Math.PI / 2);

  const material = new THREE.MeshLambertMaterial({
    color: 0x9aa09c,
    flatShading: true
  });
  return new THREE.Mesh(geom, material);
}

function expandBoundsPoints(
  box: THREE.Box3,
  bounds: RegionalMeshBounds,
  userLon: number,
  userLat: number,
  pivotLat: number,
  maxHeightM: number
) {
  const lons = [bounds.west, bounds.east];
  const lats = [bounds.south, bounds.north];
  for (const lat of lats) {
    for (const lon of lons) {
      const { east, north } = lonLatToEn(lon, lat, userLon, userLat, pivotLat);
      box.expandByPoint(new THREE.Vector3(east, 0, north));
      box.expandByPoint(new THREE.Vector3(east, maxHeightM, north));
    }
  }
}

function disposeObject3D(root: THREE.Object3D) {
  root.traverse(child => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const mat = child.material;
      if (Array.isArray(mat)) mat.forEach(m => m.dispose());
      else mat.dispose();
    }
    if (child instanceof THREE.Line) {
      child.geometry.dispose();
      const mat = child.material;
      if (Array.isArray(mat)) mat.forEach(m => m.dispose());
      else mat.dispose();
    }
  });
}

let sharedRenderer: THREE.WebGLRenderer | null = null;

function getRenderer(width: number, height: number): THREE.WebGLRenderer {
  if (!sharedRenderer) {
    sharedRenderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'low-power'
    });
  }
  sharedRenderer.setSize(width, height, false);
  sharedRenderer.setPixelRatio(1);
  return sharedRenderer;
}

/**
 * Three.js WebGL — 南側 45° 付近から見た簡易立体。結果は canvas（PNG 化可能）。
 */
export function renderBuildingsObliqueWebGL(
  buildings: BuildingVolume[],
  options: ObliqueRenderOptions
): HTMLCanvasElement {
  const { width, height, bounds, userLat, userLon, headingDeg } = options;
  const padding = options.paddingPx ?? 6;
  const pivotLat = userLat;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1f24);

  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  const sun = new THREE.DirectionalLight(0xffffff, 0.85);
  sun.position.set(0, 80, 120);
  scene.add(ambient, sun);

  const world = new THREE.Group();
  world.rotation.y = -headingDeg * DEG_TO_RAD;
  scene.add(world);

  let maxH = 12;
  for (const building of buildings) {
    maxH = Math.max(maxH, building.heightM);
    world.add(buildingMesh(building, pivotLat, userLon, userLat));
  }

  const fitBox = new THREE.Box3();
  expandBoundsPoints(fitBox, bounds, userLon, userLat, pivotLat, maxH);
  if (fitBox.isEmpty()) fitBox.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(40, 20, 40));

  const center = fitBox.getCenter(new THREE.Vector3());
  const size = fitBox.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.z, 8);
  const spanY = Math.max(size.y, 8);
  const fitRadius = Math.hypot(span, spanY) * 0.55 * (1 + padding / Math.min(width, height));

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.5, fitRadius * 40);
  const horiz = fitRadius * Math.cos(VIEW_ELEVATION_RAD);
  const elev = fitRadius * Math.sin(VIEW_ELEVATION_RAD);
  camera.position.set(center.x, center.y + elev, center.z + horiz);
  camera.lookAt(center);
  camera.updateProjectionMatrix();

  if (
    userLon >= bounds.west
    && userLon <= bounds.east
    && userLat >= bounds.south
    && userLat <= bounds.north
  ) {
    const userEn = lonLatToEn(userLon, userLat, userLon, userLat, pivotLat);
    const hRad = headingDeg * DEG_TO_RAD;
    const tipEn = {
      east: Math.sin(hRad) * 14,
      north: Math.cos(hRad) * 14
    };
    const lineGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(userEn.east, 0.4, userEn.north),
      new THREE.Vector3(tipEn.east, 0.4, tipEn.north)
    ]);
    const line = new THREE.Line(
      lineGeom,
      new THREE.LineBasicMaterial({ color: 0x4afaff, linewidth: 2 })
    );
    world.add(line);

    const dotGeom = new THREE.SphereGeometry(1.2, 8, 8);
    const dot = new THREE.Mesh(dotGeom, new THREE.MeshBasicMaterial({ color: 0x44aaff }));
    dot.position.set(userEn.east, 0.5, userEn.north);
    world.add(dot);
  }

  const renderer = getRenderer(width, height);
  renderer.render(scene, camera);

  disposeObject3D(world);

  return renderer.domElement;
}
