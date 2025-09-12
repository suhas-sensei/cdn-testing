import React, { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type Props = {
  /** bump this number to trigger a new flash */
  trigger: number;
};

export default function MuzzleFlash({ trigger }: Props) {
  const last = useRef<number>(-1);
  const startedAt = useRef<number>(-1);
  const [visible, setVisible] = useState(false);
  const strengthRef = useRef(0); // 0..1 animated per frame

  const LIFE = 0.085; // seconds the flash lasts

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

// On first mount, just sync the trigger without flashing.
// This prevents a flash when switching weapons (component remount).
if (last.current === -1) {
  last.current = trigger;
} else if (trigger !== last.current) {
  last.current = trigger;
  startedAt.current = t;
  strengthRef.current = 1;
  setVisible(true);
}


    if (!visible) return;

    const dt = t - startedAt.current;
    if (dt >= LIFE) {
      setVisible(false);
      strengthRef.current = 0;
      return;
    }

    // simple ease-out for brightness/opacity
    const k = 1 - dt / LIFE;
    strengthRef.current = k * k;
  });

  if (!visible) return null;

  const k = strengthRef.current;

  return (
    <group>
      {/* short, bright point light at muzzle */}
      <pointLight
        intensity={28 * k}
        distance={4.5}
        decay={2}
        color={"#ffd87a"}
      />

      {/* hot core cone (points forward along -Z) */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.12, 0.28, 20, 1, true]} />
        <meshBasicMaterial
          color={"#fff3c6"}
          transparent
          opacity={0.85 * k}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* outer flare */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.12]}>
        <coneGeometry args={[0.25, 0.42, 16, 1, true]} />
        <meshBasicMaterial
          color={"#ffb340"}
          transparent
          opacity={0.45 * k}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* tiny tracer stub */}
      <mesh position={[0, 0, -0.35]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.5, 6]} />
        <meshBasicMaterial
          color={"#fff9d8"}
          transparent
          opacity={0.6 * k}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
