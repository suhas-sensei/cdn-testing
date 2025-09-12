// LightProximity.tsx
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import React, { useRef } from "react";

export default function LightProximity({
  reach = 18,     // world units at which darkness is back to max
  minA = 0.05,    // alpha when standing under a light (almost no darkness)
  maxA = 0.96,    // alpha when far from all lights (full darkness)
}: { reach?: number; minA?: number; maxA?: number }) {
  const { scene, camera } = useThree();
  const tmp = useRef(new THREE.Vector3());

  useFrame(() => {
    let bestProx = 0; // 0 = far, 1 = right under a light

    scene.traverse((obj) => {
      const isPoint = (obj as any).isPointLight;
      const isSpot  = (obj as any).isSpotLight;
      const isRect  = (obj as any).isRectAreaLight;
      if (!isPoint && !isSpot && !isRect) return;

      obj.getWorldPosition(tmp.current);

      // distance to the camera
      const d = camera.position.distanceTo(tmp.current);

      // prefer the light’s own "distance" if provided
      let r = reach;
      const lightDist = (obj as any).distance;
      if (typeof lightDist === "number" && lightDist > 0) {
        r = Math.max(2, Math.min(40, lightDist)); // clamp a bit
      }

      // proximity: 1 near, 0 far
      const prox = 1 - THREE.MathUtils.smoothstep(d, 0, r);
      if (prox > bestProx) bestProx = prox;
    });

    // map proximity -> overlay alpha
    const a = THREE.MathUtils.lerp(maxA, minA, bestProx);
    (window as any).__DARK_ALPHA = THREE.MathUtils.clamp(a, 0, 1);
  });

  return null;
}
