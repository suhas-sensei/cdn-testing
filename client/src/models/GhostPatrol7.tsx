import * as THREE from "three";
import React, { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Ghost } from "./Ghost";
import useAppStore from "../zustand/store";

type Props = {
  y?: number;
  speed?: number;
  yawOffset?: number;
  scale?: number;
  debug?: boolean;
  faceLight?: boolean;
  faceLightIntensity?: number;
  faceLightDistance?: number;
  faceOffsetY?: number;
  faceOffsetZ?: number;
  collideRadius?: number;   // visual only
  showCollider?: boolean;
  onVanish?: () => void;
};

export default function GhostPatrol7({
  y = 0.7,
  speed = 2.5,
  yawOffset = 0,
  scale = 1,
  debug = false,
  faceLight = true,
  faceLightIntensity = 1,
  faceLightDistance = 6,
  faceOffsetY = 2,
  faceOffsetZ = 0.02,
  collideRadius = 1.8,
  showCollider = false,
  onVanish,
}: Props) {
  const group = useRef<THREE.Group>(null);
  const ghostRoot = useRef<THREE.Group>(null);
  const culledFixedRef = useRef(false);
  const materialsLocalizedRef = useRef(false);


  // spawn at x:295, z:345
  const spawnX = 402;
  const spawnZ = 322;

  // 10s lifetime + 1m standoff
  const lifeSecRef = useRef(0);
  const vanishedRef = useRef(false);
  const minDistance = 1.0;

  useEffect(() => {
    if (!group.current) return;
    group.current.position.set(spawnX, y, spawnZ);
    group.current.rotation.y = yawOffset;
    vanishedRef.current = false;
    lifeSecRef.current = 0;
  }, [y, yawOffset]);

  // disable frustum culling & make materials transparent-friendly
  useEffect(() => {
    let raf = 0;
    const apply = () => {
      const root = ghostRoot.current;
      if (!root) { raf = requestAnimationFrame(apply); return; }
      if (culledFixedRef.current) return;

      let found = 0;
      root.traverse((o: any) => {
        if (o?.isMesh || o?.isSkinnedMesh) {
          o.frustumCulled = false;
          found++;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (!m) continue;
            if ("transparent" in m) m.transparent = true;
            if ("depthWrite" in m) m.depthWrite = false;
            if ("side" in m) m.side = THREE.DoubleSide;
          }
        }
      });
      if (!materialsLocalizedRef.current) {
  root.traverse((o: any) => {
    if (o?.isMesh || o?.isSkinnedMesh) {
      if (Array.isArray(o.material)) {
        o.material = o.material.map((m: any) =>
          m?.isMaterial && m.clone ? m.clone() : m
        );
      } else if (o.material?.isMaterial && o.material.clone) {
        o.material = o.material.clone();
      }
    }
  });
  materialsLocalizedRef.current = true;
}

      if (found > 0) culledFixedRef.current = true;
      else raf = requestAnimationFrame(apply);
    };
    raf = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ----- hard hide helper -----
const hardHide = () => {
  const g = group.current
  if (!g) return
  // Just hide this instance; do not remove() or edit materials.
  g.visible = false
}


  // smooth face
  const qTarget = useRef(new THREE.Quaternion());
  const eTmp = useRef(new THREE.Euler(0, 0, 0, "YXZ"));

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;

    if (vanishedRef.current) return;

    lifeSecRef.current += dt;
    if (lifeSecRef.current >= 10) {
      vanishedRef.current = true;
      hardHide();
      onVanish?.();
      return;
    }

    // follow player but stop at 1m (no pushback ever)
    const { position: playerPos } = useAppStore.getState();
    if (playerPos) {
      const dx = playerPos.x - g.position.x;
      const dz = playerPos.z - g.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist > minDistance) {
        const gap = dist - minDistance;
        const step = Math.min(speed * dt, gap);
        g.position.x += (dx / dist) * step;
        g.position.z += (dz / dist) * step;
      }

      if (dist > 1e-6) {
        const yaw = Math.atan2(dx, dz) + yawOffset;
        eTmp.current.set(0, yaw, 0, "YXZ");
        qTarget.current.setFromEuler(eTmp.current);
        const t = 1 - Math.exp(-8 * dt);
        g.quaternion.slerp(qTarget.current, t);
      }
    }
  });

  return (
    <group ref={group} position={[spawnX, y, spawnZ]} userData={{ isEntity: true, ghostId: 4 }}>
      {debug && (
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[0.5, 1, 0.5]} />
          <meshBasicMaterial wireframe />
        </mesh>
      )}

      {showCollider && (
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[collideRadius, 24, 16]} />
          <meshBasicMaterial color="#ff0000" wireframe transparent opacity={0.25} />
        </mesh>
      )}

      {faceLight && (
        <group position={[0, faceOffsetY, faceOffsetZ]}>
          <mesh>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshBasicMaterial color="#ff2a2a" toneMapped={false} />
          </mesh>
          <pointLight color="#ff2a2a" intensity={faceLightIntensity} distance={faceLightDistance} decay={5} />
        </group>
      )}

      <group ref={ghostRoot} scale={scale} renderOrder={1}>
        <Ghost />
    </group>
    </group>
  );
}
