import * as THREE from 'three';
import type { BuildingVolume } from './geojson-buildings.js';
import type { RegionalMeshBounds } from './mesh-code.js';
import type { ObliqueRenderOptions } from './render-oblique.js';
import { getViewCameraSpherical } from '../view/view-camera-state.js';

const DEG_TO_RAD = Math.PI / 180;
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

/** ワールド: X=東, Y=上, Z=北。Extrude+rotateX(-π/2) では Shape の Y を反転して Z+ を北にする */
function buildingMesh(building: BuildingVolume, pivotLat: number, userLon: number, userLat: number): THREE.Mesh {
  const shape = new THREE.Shape();
  const ring = building.outer;
  for (let i = 0; i < ring.length; i += 1) {
    const [lon, lat] = ring[i];
    const { east, north } = lonLatToEn(lon, lat, userLon, userLat, pivotLat);
    if (i === 0) shape.moveTo(east, -north);
    else shape.lineTo(east, -north);
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

function addUserMarker(world: THREE.Group, headingDeg: number) {
  const hRad = headingDeg * DEG_TO_RAD;
  const tip = { east: Math.sin(hRad) * 16, north: Math.cos(hRad) * 16 };

  const ringGeom = new THREE.RingGeometry(2.2, 3.4, 24);
  const ring = new THREE.Mesh(
    ringGeom,
    new THREE.MeshBasicMaterial({ color: 0x44aaff, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  world.add(ring);

  const poleGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0.15, 0),
    new THREE.Vector3(0, 6, 0)
  ]);
  world.add(new THREE.Line(poleGeom, new THREE.LineBasicMaterial({ color: 0x66ccff })));

  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(1.8, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0x4afaff })
  );
  dot.position.y = 0.8;
  world.add(dot);

  const arrowGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0.5, 0),
    new THREE.Vector3(tip.east, 0.5, tip.north)
  ]);
  world.add(new THREE.Line(arrowGeom, new THREE.LineBasicMaterial({ color: 0x4afaff, linewidth: 2 })));
}

/**
 * Three.js WebGL — kuwaya 型球面カメラ（南固定・ユーザー注視）。地図回転は heading で world の Y 回転のみ。
 */
export function renderBuildingsObliqueWebGL(
  buildings: BuildingVolume[],
  options: ObliqueRenderOptions
): HTMLCanvasElement {
  const { width, height, userLat, userLon, headingDeg } = options;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1f24);

  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  const sun = new THREE.DirectionalLight(0xffffff, 0.85);
  sun.position.set(-40, 120, -60);
  scene.add(ambient, sun);

  const world = new THREE.Group();
  world.rotation.y = -headingDeg * DEG_TO_RAD;
  scene.add(world);

  const pivotLat = userLat;
  for (const building of buildings) {
    world.add(buildingMesh(building, pivotLat, userLon, userLat));
  }

  addUserMarker(world, headingDeg);

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
