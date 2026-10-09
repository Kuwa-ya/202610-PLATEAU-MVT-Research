/*!
 * ちずうつし (kuwaya-geo) — JavaScript source module
 *
 * Copyright © 2026 Kuwa-ya, Ltd. All Rights Reserved.
 * Full license text: ./legal/SOURCE-CODE-LICENSE.txt
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
 * WITHOUT WARRANTY OF ANY KIND. SEE ./legal/SOURCE-CODE-LICENSE.txt.
 */

import {
  CAMERA_DEFAULT_DISTANCE,
  CAMERA_DRAG_THRESHOLD_SQUARED,
  CAMERA_MAX_ANGLE,
  CAMERA_MAX_DISTANCE,
  CAMERA_MAX_MOVE_FROM_ORIGIN,
  CAMERA_MIN_ANGLE,
  CAMERA_MIN_DISTANCE
} from '../config.js';

export function createCameraController(THREE) {
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300000);
  const target = new THREE.Vector3();
  const focusedTarget = new THREE.Vector3();
  const spherical = new THREE.Spherical(
    THREE.MathUtils.clamp(CAMERA_DEFAULT_DISTANCE, CAMERA_MIN_DISTANCE, CAMERA_MAX_DISTANCE),
    Math.PI / 6,
    0
  );
  const focusedSpherical = spherical.clone();

  function update() {
    camera.position.setFromSpherical(spherical).add(target);
    camera.lookAt(target);
    camera.far = Math.max(10000, spherical.radius * 8);
    camera.updateProjectionMatrix();
  }

  function resize(width, height) {
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  }

  function step(delta, lerpRate) {
    const alpha = 1 - Math.exp(-lerpRate * Math.min(delta, 0.1));
    target.lerp(focusedTarget, alpha);
    spherical.radius = THREE.MathUtils.lerp(spherical.radius, focusedSpherical.radius, alpha);
    spherical.phi = THREE.MathUtils.lerp(spherical.phi, focusedSpherical.phi, alpha);
    spherical.theta = THREE.MathUtils.lerp(spherical.theta, focusedSpherical.theta, alpha);
    update();
  }

  function recenter(group) {
    const center = new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3());
    focusedTarget.copy(center);
    target.copy(focusedTarget);
    spherical.copy(focusedSpherical);
    update();
  }

  return { camera, target, focusedTarget, spherical, focusedSpherical, update, resize, step, recenter };
}

export function createCameraInputState() {
  return { pointer: null, activePointers: new Map(), pinch: null };
}

export function bindCameraInteractions(THREE, canvas, cameraState, callbacks = {}) {
  const input = createCameraInputState();
  const { focusedTarget, focusedSpherical } = cameraState;
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  canvas.addEventListener('pointerdown', event => {
    try { canvas.setPointerCapture(event.pointerId); } catch { /* Synthetic events do not own a pointer. */ }
    input.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (input.activePointers.size >= 2) {
      const [first, second] = [...input.activePointers.values()];
      input.pinch = {
        distance: Math.hypot(second.x - first.x, second.y - first.y),
        centerY: (first.y + second.y) / 2,
        radius: focusedSpherical.radius,
        basePhi: focusedSpherical.phi,
        mode: null
      };
      input.pointer = null;
      return;
    }
    input.pointer = {
      startX: event.clientX, startY: event.clientY, button: event.button,
      rotatingX: event.button === 2, dragging: false,
      baseTarget: focusedTarget.clone(), basePhi: focusedSpherical.phi
    };
  });
  canvas.addEventListener('pointermove', event => {
    if (input.activePointers.has(event.pointerId)) input.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (input.activePointers.size >= 2 && input.pinch) {
      const [first, second] = [...input.activePointers.values()];
      const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
      const centerY = (first.y + second.y) / 2;
      if (!input.pinch.mode) {
        if (Math.abs(distance - input.pinch.distance) > 8) input.pinch.mode = 'zoom';
        else if (Math.abs(centerY - input.pinch.centerY) > 8) input.pinch.mode = 'rotateX';
        else return;
      }
      if (input.pinch.mode === 'zoom') {
        focusedSpherical.radius = THREE.MathUtils.clamp(
          input.pinch.radius * input.pinch.distance / distance, CAMERA_MIN_DISTANCE, CAMERA_MAX_DISTANCE
        );
        callbacks.onZoom?.();
      } else {
        const angle = THREE.MathUtils.clamp(
          Math.PI / 2 - input.pinch.basePhi + THREE.MathUtils.degToRad((centerY - input.pinch.centerY) * 0.15),
          CAMERA_MIN_ANGLE, CAMERA_MAX_ANGLE
        );
        focusedSpherical.phi = Math.max(0.0001, Math.PI / 2 - angle);
      }
      return;
    }
    if (callbacks.isSelectionPreview?.() && (input.activePointers.size === 0 || input.pointer?.button === 0)) {
      callbacks.onSelectionPreview?.(event);
      return;
    }
    if (!input.pointer) return;
    const dx = event.clientX - input.pointer.startX, dy = event.clientY - input.pointer.startY;
    if (!input.pointer.dragging && dx * dx + dy * dy <= CAMERA_DRAG_THRESHOLD_SQUARED) return;
    input.pointer.dragging = true;
    if (input.pointer.rotatingX) {
      const angle = THREE.MathUtils.clamp(
        Math.PI / 2 - input.pointer.basePhi + THREE.MathUtils.degToRad(dy * 0.15), CAMERA_MIN_ANGLE, CAMERA_MAX_ANGLE
      );
      focusedSpherical.phi = Math.max(0.0001, Math.PI / 2 - angle);
      return;
    }
    const speed = -focusedSpherical.radius / 500;
    focusedTarget.copy(input.pointer.baseTarget).add(new THREE.Vector3(dx * speed, 0, dy * speed));
    const distance = Math.hypot(focusedTarget.x, focusedTarget.z);
    if (distance > CAMERA_MAX_MOVE_FROM_ORIGIN) {
      const scale = CAMERA_MAX_MOVE_FROM_ORIGIN / distance;
      focusedTarget.x *= scale; focusedTarget.z *= scale;
    }
    callbacks.onPan?.();
  });
  canvas.addEventListener('pointerup', event => {
    input.activePointers.delete(event.pointerId);
    if (input.activePointers.size < 2) input.pinch = null;
    const wasPanning = input.pointer?.dragging && !input.pointer?.rotatingX;
    const wasSelectionClick = callbacks.isSelectionClick?.(input.pointer) ?? false;
    input.pointer = null;
    if (wasSelectionClick) callbacks.onSelectionClick?.(event);
    if (wasPanning) callbacks.onPanEnd?.();
  });
  canvas.addEventListener('pointercancel', event => {
    input.activePointers.delete(event.pointerId);
    if (input.activePointers.size < 2) input.pinch = null;
    input.pointer = null;
  });
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    focusedSpherical.radius = THREE.MathUtils.clamp(
      focusedSpherical.radius * (1 + Math.sign(event.deltaY) / 15), CAMERA_MIN_DISTANCE, CAMERA_MAX_DISTANCE
    );
    callbacks.onZoom?.();
  }, { passive: false });
  return input;
}

export function createViewer(THREE, canvas, pixelRatio = 1) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(pixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x111a17, 1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111a17);
  scene.fog = new THREE.Fog(0x111a17, 10000, 100000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x344039, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.8);
  sun.position.set(-800, 1400, -600);
  scene.add(sun);
  return { renderer, scene };
}

export function updateOverlayLabelScales(THREE, camera, viewportHeight, groups) {
  const height = Math.max(viewportHeight, 1);
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  for (const group of groups) {
    if (!group) continue;
    group.traverse(object => {
      const pixelHeight = object.userData.contourLabelPixels ?? object.userData.previewLabelPixels;
      if (!object.isSprite || !pixelHeight) return;
      const worldPosition = object.getWorldPosition(new THREE.Vector3());
      const distance = Math.max(camera.position.distanceTo(worldPosition), camera.near);
      const worldHeight = 2 * distance * Math.tan(verticalFov / 2) * pixelHeight / height;
      object.scale.set(worldHeight * (object.userData.labelAspect ?? 4), worldHeight, 1);
    });
  }
}
