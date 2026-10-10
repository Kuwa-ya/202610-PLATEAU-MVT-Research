import * as THREE from 'three';
import type { BuildingVolume } from './geojson-buildings.js';
import type { RegionalMeshBounds } from './mesh-code.js';
import type { ObliqueRenderOptions } from './render-oblique.js';
import { enToGroundVector3, lonLatToEnMeters } from './en-footprint.js';
import { getViewCameraSpherical } from '../view/view-camera-state.js';

const DEG_TO_RAD = Math.PI / 180;

function lonLatToEn(
  lon: number,
  lat: number,
  userLon: number,
  userLat: number,
  pivotLat: number
): { east: number; north: number } {
  return lonLatToEnMeters(lon, lat, userLon, userLat, pivotLat);
}

/**
 * kuwaya `toLocalPosition`: X=東, Y=高さ, Z=-北。
 * Shape は XY、+Z へ押し出し後 rotateX(+π/2) で Y=高さ・Z=-shapeY。
 */
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
  geom.rotateX(Math.PI / 2);

  const material = new THREE.MeshLambertMaterial({
    color: 0xa8b0ac,
    flatShading: true,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  return new THREE.Mesh(geom, material);
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
  sharedRenderer.sortObjects = true;
  return sharedRenderer;
}

function addUseDistrictOutline(
  world: THREE.Group,
  ring: Array<[number, number]>,
  userLon: number,
  userLat: number,
  pivotLat: number
) {
  if (ring.length < 3) return;
  const pts = ring.map(([lon, lat]) => {
    const { east, north } = lonLatToEn(lon, lat, userLon, userLat, pivotLat);
    const g = enToGroundVector3(east, north, 0.5);
    return new THREE.Vector3(g.x, g.y, g.z);
  });
  const geom = new THREE.BufferGeometry().setFromPoints(pts);
  world.add(
    new THREE.LineLoop(
      geom,
      new THREE.LineBasicMaterial({ color: 0xc084fc, transparent: true, opacity: 0.95 })
    )
  );
}

function addUserMarker(world: THREE.Group, movementBearingDeg: number | null) {
  const ringGeom = new THREE.RingGeometry(2.8, 4.6, 28);
  const ring = new THREE.Mesh(
    ringGeom,
    new THREE.MeshBasicMaterial({ color: 0x88ddff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.2;
  world.add(ring);

  const poleGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0.2, 0),
    new THREE.Vector3(0, 8, 0)
  ]);
  world.add(new THREE.Line(poleGeom, new THREE.LineBasicMaterial({ color: 0xb8ecff })));

  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 14, 14),
    new THREE.MeshBasicMaterial({ color: 0xe8f8ff })
  );
  dot.position.y = 1;
  world.add(dot);

  if (movementBearingDeg != null && Number.isFinite(movementBearingDeg)) {
    const hRad = movementBearingDeg * DEG_TO_RAD;
    const tipEast = Math.sin(hRad) * 18;
    const tipNorth = Math.cos(hRad) * 18;
    // 建物は Z=-北。グループ scale.x=-1 は東西のみ反転するため、矢印の北成分は +Z に置く
    const arrowGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.6, 0),
      new THREE.Vector3(tipEast, 0.6, tipNorth)
    ]);
    world.add(new THREE.Line(arrowGeom, new THREE.LineBasicMaterial({ color: 0xfff078 })));
  }
}

/**
 * Three.js WebGL — kuwaya 型球面カメラ（南固定・ユーザー注視）。地図は北上固定（world 回転なし）。
 */
export function renderBuildingsObliqueWebGL(
  buildings: BuildingVolume[],
  options: ObliqueRenderOptions
): HTMLCanvasElement {
  const { width, height, userLat, userLon, movementBearingDeg, useDistrictRing } = options;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1f24);

  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  const sun = new THREE.DirectionalLight(0xffffff, 0.85);
  sun.position.set(-40, 120, -60);
  scene.add(ambient, sun);

  const world = new THREE.Group();
  world.scale.x = -1;
  scene.add(world);

  const pivotLat = userLat;
  for (const building of buildings) {
    world.add(buildingMesh(building, pivotLat, userLon, userLat));
  }

  if (useDistrictRing?.length) {
    addUseDistrictOutline(world, useDistrictRing, userLon, userLat, pivotLat);
  }

  addUserMarker(world, movementBearingDeg);

  const target = new THREE.Vector3(0, 0, 0);
  const spherical = new THREE.Spherical();
  const cam = getViewCameraSpherical();
  spherical.radius = cam.radius;
  spherical.phi = cam.phi;
  spherical.theta = cam.theta;

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.5, cam.radius * 12);
  camera.position.setFromSpherical(spherical).add(target);
  camera.lookAt(target);
  camera.updateProjectionMatrix();

  const renderer = getRenderer(width, height);
  renderer.render(scene, camera);

  disposeObject3D(world);

  return renderer.domElement;
}
