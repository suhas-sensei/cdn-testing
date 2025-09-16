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
    healthPct?: number;
  onVanish?: () => void;
};

export default function GhostPatrol4({
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
    healthPct = 1,
}: Props) {
  const group = useRef<THREE.Group>(null);
  const ghostRoot = useRef<THREE.Group>(null);
  const culledFixedRef = useRef(false);
  const materialsLocalizedRef = useRef(false);


  // spawn at x:295, z:345
  const spawnX = 295;
  const spawnZ = 345;

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

function GhostHitbox({
  size = [3, 5, 1.5],     // [width, height, depth] — tweak per ghost scale
  center = [0, 4, 0],
}: { size?: [number, number, number]; center?: [number, number, number] }) {
  return (
    <mesh
      position={center}
      visible={false}                 // invisible but raycastable
      userData={{ isEntity: true }}   // <-- makes hits count as enemy
    >
      <boxGeometry args={size} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
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
function HealthBar({ pct = 1, y = 2.6 }: { pct?: number; y?: number }) {
  const barRef = React.useRef<THREE.Group>(null);

  // keep the bar facing the camera
  useFrame(({ camera }) => {
    if (barRef.current) {
      barRef.current.quaternion.copy(camera.quaternion);
    }
  });

  // clamp
  const p = Math.max(0, Math.min(1, pct));
  const W = 1.6;        // total width of the bar
  const H = 0.12;       // height
  const innerW = W * p; // red width

  return (
    <group ref={barRef} position={[0, y, 0]}>
      {/* background */}
      <mesh>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial color="black" />
      </mesh>
      {/* red foreground (anchor left) */}
      <mesh position={[(-W / 2) + (innerW / 2), 0, 0.001]}>
        <planeGeometry args={[innerW, H * 0.8]} />
        <meshBasicMaterial color="#ff3b3b" />
      </mesh>
    </group>
  );
}

  return (
    <group ref={group} position={[spawnX, y, spawnZ]} userData={{ isEntity: true, ghostId: 4 }}>
        <GhostHitbox size={[3, 5, 1.5]} center={[0, 4, 0]} />
        
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
