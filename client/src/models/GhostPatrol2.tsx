// client/src/models/GhostPatrol2.tsx
import * as THREE from "three";
import React, { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Ghost } from "./Ghost";
import useAppStore from "../zustand/store";

type Props = {
  y?: number;
  loops?: number;
  speed?: number;
  yawOffset?: number;
  scale?: number;
  debug?: boolean;
  faceLight?: boolean;
  faceLightIntensity?: number;
  faceLightDistance?: number;
  faceOffsetY?: number;
  faceOffsetZ?: number;
  collideRadius?: number;
  showCollider?: boolean;
    healthPct?: number;
};

export default function GhostPatrol2({
  y = 0.7,
  loops = 4,
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
    healthPct = 1,
}: Props) {
  const group = useRef<THREE.Group>(null);
  const ghostRoot = useRef<THREE.Group>(null);
  const culledFixedRef = useRef(false);
const materialsLocalizedRef = useRef(false);

  // Patrol along X between 338..357 at Z=354
  const spawnX = 347;
  const spawnZ = 354;
  const leftX = 338;
  const rightX = 357;

  const goingRightRef = useRef(true);
  const loopsDoneRef = useRef(0);
  const hitRightRef = useRef(false);
const qTarget = useRef(new THREE.Quaternion());
const eTmp = useRef(new THREE.Euler(0, 0, 0, "YXZ"));

  useEffect(() => {
    let raf = 0;
    const ensureNoCulling = () => {
      const root = ghostRoot.current;
      if (!root) {
        raf = requestAnimationFrame(ensureNoCulling);
        return;
      }
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
        o.layers?.enable?.(0);
      });
      if (found > 0) {
        culledFixedRef.current = true;
        root.frustumCulled = false;
      } else {
        raf = requestAnimationFrame(ensureNoCulling);
      }
    };
    raf = requestAnimationFrame(ensureNoCulling);
    return () => cancelAnimationFrame(raf);
  }, []);
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
  useEffect(() => {
    if (!group.current) return;
    group.current.position.set(spawnX, y, spawnZ);
    group.current.rotation.y = Math.atan2(0, 1) + yawOffset;
  }, [y, yawOffset]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;

    // Patrol motion (along X)
    if (loopsDoneRef.current < loops) {
      const targetX = goingRightRef.current ? rightX : leftX;
      const dirX = Math.sign(targetX - g.position.x) || 1;
      const step = dirX * speed * dt;

      const willOvershoot =
        (dirX > 0 && g.position.x + step >= targetX) ||
        (dirX < 0 && g.position.x + step <= targetX);

      if (willOvershoot) {
        g.position.x = targetX;
        if (goingRightRef.current) {
          goingRightRef.current = false;
          hitRightRef.current = true;
        } else {
          if (hitRightRef.current) {
            loopsDoneRef.current += 1;
            hitRightRef.current = false;
          }
          if (loopsDoneRef.current < loops) goingRightRef.current = true;
        }
        const nextDirX = goingRightRef.current ? 1 : -1;
    // yaw handled by face-player slerp

      } else {
        g.position.x += step;
        // yaw handled by face-player slerp

      }
    }
// === FACE PLAYER (smooth yaw via quaternion slerp) ===
{
  const { position: playerPos } = useAppStore.getState();
  if (playerPos) {
    const dx = playerPos.x - g.position.x;
    const dz = playerPos.z - g.position.z;
    const distSq = dx * dx + dz * dz;
    if (distSq > 1e-6) {
      const yaw = Math.atan2(dx, dz) + yawOffset;
      eTmp.current.set(0, yaw, 0, "YXZ");
      qTarget.current.setFromEuler(eTmp.current);
      const t = 1 - Math.exp(-8 * dt);
      g.quaternion.slerp(qTarget.current, t);
    }
  }
}

    const { position: playerPos, updatePosition } = useAppStore.getState();
    if (playerPos && updatePosition) {
      const dx = playerPos.x - g.position.x;
      const dz = playerPos.z - g.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 0 && dist < collideRadius) {
        const nx = dx / dist;
        const nz = dz / dist;
        const safeX = g.position.x + nx * collideRadius;
        const safeZ = g.position.z + nz * collideRadius;
        updatePosition(new THREE.Vector3(safeX, playerPos.y, safeZ));
      } else if (dist === 0) {
        updatePosition(new THREE.Vector3(g.position.x + collideRadius, playerPos.y, g.position.z));
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
    <group ref={group} position={[spawnX, y, spawnZ]} userData={{ isEntity: true }}>
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
