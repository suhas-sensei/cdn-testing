// client/src/models/GhostPatrol5.tsx
import * as THREE from "three";
import React, { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Ghost } from "./Ghost";
import useAppStore from "../zustand/store";

type Props = {
  y?: number;
  speed?: number;         // kept for consistency (not moving in this behavior)
  yawOffset?: number;
  scale?: number;
  debug?: boolean;

  faceLight?: boolean;
  faceLightIntensity?: number;
  faceLightDistance?: number;
  faceOffsetY?: number;
  faceOffsetZ?: number;

  showCollider?: boolean;
  onVanish?: () => void;
};

export default function GhostPatrol5({
  y = 0.7,
  speed = 0,
  yawOffset = 0,
  scale = 1,
  debug = false,

  faceLight = true,
  faceLightIntensity = 1,
  faceLightDistance = 6,
  faceOffsetY = 2,
  faceOffsetZ = 0.02,

  showCollider = false,
  onVanish,
}: Props) {
  const group = useRef<THREE.Group>(null);
  const ghostRoot = useRef<THREE.Group>(null);

  // Spawn at x: 295, z: 278 (frontend "y" == world Z)
  const spawnX = 295;
  const spawnZ = 278;

  // Blink state
  const triggeredRef = useRef(false);   // becomes true once player is within 15 m
  const blinkTimerRef = useRef(0);      // accumulates time for 1s toggles
  const blinkOffCountRef = useRef(0);   // count how many times we turned invisible
  const vanishedRef = useRef(false);    // final state after sequence

  const qTarget = useRef(new THREE.Quaternion());
  const eTmp = useRef(new THREE.Euler(0, 0, 0, "YXZ"));

  const { camera } = useThree();

  useEffect(() => {
    if (!group.current) return;
    group.current.position.set(spawnX, y, spawnZ);
    group.current.rotation.y = yawOffset;
    // reset session state
    triggeredRef.current = false;
    blinkTimerRef.current = 0;
    blinkOffCountRef.current = 0;
    vanishedRef.current = false;
    // ensure visible at spawn
    group.current.visible = true;
    if (ghostRoot.current) ghostRoot.current.visible = true;
  }, [y, yawOffset]);

  // Hide whole instance (mesh + red ball + light) without touching materials
  const vanishHard = () => {
    const g = group.current;
    if (!g) return;
    g.visible = false;                  // hides light & children too
    if (ghostRoot.current) ghostRoot.current.visible = false;
    onVanish?.();
  };

  useFrame((_, dt) => {
    const g = group.current;
    if (!g || vanishedRef.current) return;

    // Smoothly face player (nice touch, optional)
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

    const { position: playerPos } = useAppStore.getState();
    if (!triggeredRef.current && playerPos) {
      // Trigger when player is within 15 m (2D distance)
      const dx = playerPos.x - g.position.x;
      const dz = playerPos.z - g.position.z;
      const dist2D = Math.hypot(dx, dz);
      if (dist2D <= 35) {
        triggeredRef.current = true;
        blinkTimerRef.current = 0;
        blinkOffCountRef.current = 0;
        // Make sure we start visible for the first toggle to turn it off
        g.visible = true;
        if (ghostRoot.current) ghostRoot.current.visible = true;
      }
    }

    // Once triggered, blink: toggle visibility every 1 second.
    if (triggeredRef.current) {
      blinkTimerRef.current += dt;
      if (blinkTimerRef.current >= 1.0) {
        blinkTimerRef.current -= 1.0;

        // Toggle
        g.visible = !g.visible;
        if (ghostRoot.current) ghostRoot.current.visible = g.visible;

        // Count only the "off" moments as blinks
        if (!g.visible) {
          blinkOffCountRef.current += 1;
          // After 3 disappearances, vanish for good
          if (blinkOffCountRef.current >= 3) {
            vanishedRef.current = true;
            vanishHard();
            return;
          }
        }
      }
    }
  });

  return (
    // NOTE: no userData.isEntity so this ghost doesn't interfere with AimProbe/F shooting UI
    <group ref={group} position={[spawnX, y, spawnZ]} userData={{ ghostId: 5 }}>
      {debug && (
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[0.5, 1, 0.5]} />
          <meshBasicMaterial wireframe />
        </mesh>
      )}

      {showCollider && (
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[1.8 * scale, 24, 16]} />
          <meshBasicMaterial color="#ff0000" wireframe transparent opacity={0.25} />
        </mesh>
      )}

      {/* red face light + ball */}
      {faceLight && (
        <group position={[0, faceOffsetY, faceOffsetZ]}>
          <mesh>
            <sphereGeometry args={[0.06 * scale, 16, 16]} />
            <meshBasicMaterial color="#ff2a2a" toneMapped={false} />
          </mesh>
          <pointLight
            color="#ff2a2a"
            intensity={faceLightIntensity}
            distance={faceLightDistance}
            decay={5}
          />
        </group>
      )}

      {/* Isolated GLTF instance (from Ghost.tsx, which deep-clones materials/skeleton) */}
      <group ref={ghostRoot} scale={scale} renderOrder={1}>
        <Ghost />
      </group>
    </group>
  );
}
