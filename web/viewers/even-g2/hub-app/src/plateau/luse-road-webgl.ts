/*!
 * PLATEAU MVT Research — Even G2 WebGL 道路用地メッシュ
 */

import * as THREE from 'three';
import type { RoadMeshBuffers } from './luse-road-cache.js';
import { G2_VISUAL } from '../config/g2-visual.js';

export function addLuseRoadMeshesToWorld(world: THREE.Group, meshes: RoadMeshBuffers[]): void {
  const material = new THREE.MeshLambertMaterial({
    color: G2_VISUAL.roadColor,
    flatShading: true,
    transparent: true,
    opacity: G2_VISUAL.roadOpacity,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  for (const mesh of meshes) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    geometry.computeVertexNormals();
    world.add(new THREE.Mesh(geometry, material));
  }
}
