// client/src/models/GhostPatrol.tsx
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

export default function GhostPatrol({
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

  collideRadius = 3,
  showCollider = false,
   healthPct = 1
}: Props) {
  const group = useRef<THREE.Group>(null);
  const ghostRoot = useRef<THREE.Group>(null);
  const culledFixedRef = useRef(false);
const materialsLocalizedRef = useRef(false);

  // Fixed X, patrol along Z
  const spawnX = 372;
  const spawnZ = 396;
  const topZ = 402;
  const bottomZ = 393;

  const goingRightRef = useRef(true);
  const loopsDoneRef = useRef(0);
  const hitRightRef = useRef(false);
const qTarget = useRef(new THREE.Quaternion());
const eTmp = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
const autoYawFixRef = useRef<number | null>(null); // computed once from GLTF forward

  // Ensure GLTF subtree is de-cull'ed once it exists
  useEffect(() => {
    let raf = 0;
    const ensureNoCulling = () => {
      const root = ghostRoot.current;
      if (!root) {
        raf = requestAnimationFrame(ensureNoCulling);
        return;
      }
      // Skip if we already processed successfully
      if (culledFixedRef.current) return;

      let foundMeshes = 0;
      root.traverse((o: any) => {
        if (o?.isMesh || o?.isSkinnedMesh) {
          o.frustumCulled = false;
          foundMeshes++;
          // Helpful defaults for translucent/glowy ghost parts
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (!m) continue;
            if ("transparent" in m) m.transparent = true;
            if ("depthWrite" in m) m.depthWrite = false;
            if ("side" in m) m.side = THREE.DoubleSide;
          }
        }
        // Force default layer in case model came with odd layers
        o.layers?.enable?.(0);
      });
// Give this instance its own materials so edits don't affect other ghosts
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

      if (foundMeshes > 0) {
        culledFixedRef.current = true;
        // Also disable culling on parent ghosts
        root.frustumCulled = false;

        // --- Auto-calibrate yaw: what's the model's current forward yaw? ---
// getWorldDirection returns the object's local -Z in world space.
const fwd = new THREE.Vector3();
(ghostRoot.current as THREE.Object3D).getWorldDirection(fwd);
const modelYaw0 = Math.atan2(fwd.x, fwd.z);   // yaw of current (-Z) forward
autoYawFixRef.current = -modelYaw0;           // correction so our +Z-aim formula works

      } else {
        // Try again next frame until Ghost GLTF is mounted
        raf = requestAnimationFrame(ensureNoCulling);
      }
    };

    raf = requestAnimationFrame(ensureNoCulling);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Place & face +Z on mount
  useEffect(() => {
    if (!group.current) return;
    group.current.position.set(spawnX, y, spawnZ);
// initial yaw handled by face-player slerp


    // Parent helpers (non-GLTF children)
    group.current.traverse((o: any) => {
      if (o?.isMesh) {
        o.castShadow = true;
        o.receiveShadow = false;
      }
      // Do not rely on this for GLTF meshes (handled above once loaded)
    });

    console.log("[GhostPatrol] spawned at", group.current.position.toArray());
  }, [y, yawOffset]);
// ⬆️ keep your imports

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

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;

    // Patrol motion (along Z)
    if (loopsDoneRef.current < loops) {
      const targetZ = goingRightRef.current ? topZ : bottomZ;
      const dirZ = Math.sign(targetZ - g.position.z) || 1;
      const step = dirZ * speed * dt;

      const willOvershoot =
        (dirZ > 0 && g.position.z + step >= targetZ) ||
        (dirZ < 0 && g.position.z + step <= targetZ);

      if (willOvershoot) {
        g.position.z = targetZ;
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
        const nextDirZ = goingRightRef.current ? 1 : -1;
       // yaw handled by face-player slerp

      } else {
        g.position.z += step;
      // yaw handled by face-player slerp

      }
    }

    
// === FACE PLAYER (smooth yaw via quaternion slerp + auto-calibration) ===
{
  const { position: playerPos } = useAppStore.getState();
  if (playerPos) {
    const dx = playerPos.x - g.position.x;
    const dz = playerPos.z - g.position.z;
    const distSq = dx * dx + dz * dz;
    if (distSq > 1e-6) {
      // combine the auto-calibrated correction (from GLTF forward) with any manual yawOffset (radians)
      const autoFix = (autoYawFixRef.current ?? 0) + (yawOffset ?? 0);
      const yaw = Math.atan2(dx, dz) + autoFix;

      eTmp.current.set(0, yaw, 0, "YXZ");
      qTarget.current.setFromEuler(eTmp.current);

      // dt-stable smoothing (raise 8 for snappier turning)
      const t = 1 - Math.exp(-8 * dt);
      g.quaternion.slerp(qTarget.current, t);
    }
  }
}


    // Soft collision pushback
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
        updatePosition(new THREE.Vector3(g.position.x, playerPos.y, g.position.z + collideRadius));
      }
    }
  });

// (slerp handled inside the useFrame callback; duplicate outer block removed)

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

        {/* ✅ new: full-body hitbox */}
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

      {/* red face light */}
      {faceLight && (
        <group position={[0, faceOffsetY, faceOffsetZ]}>
          <mesh>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshBasicMaterial color="#ff2a2a" toneMapped={false} />
          </mesh>
          <pointLight color="#ff2a2a" intensity={faceLightIntensity} distance={faceLightDistance} decay={5} />
        </group>
      )}

      {/* Wrap Ghost with a ref so we can safely de-cull after GLTF mounts */}
      <group ref={ghostRoot} scale={scale} renderOrder={1}>
        <Ghost />
      </group>
    </group>
  );
}
