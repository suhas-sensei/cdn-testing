import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

type Props = {
  intensity?: number;
  distance?: number;
  angle?: number;     // radians
  penumbra?: number;  // 0..1
  decay?: number;     // physically-correct falloff
};

export default function Flashlight({
  intensity = 60,
  distance = 35,
  angle = 0.7,
  penumbra = 0.18,
  decay = 1.5,
}: Props) {
  const { camera } = useThree();
  const light = useRef<THREE.SpotLight>(null);
  const target = useRef<THREE.Object3D>(new THREE.Object3D());

  // Keep the "base" brightness to restore between flicker windows
  const baseIntensity = useRef(intensity);

  // Internal flicker state
  const flicker = useRef({
    inWindow: false,
    nextWindowStart: 0, // when the next 3–4s window begins
    windowEnd: 0,       // when the current window ends
    nextToggle: 0,      // when to toggle on/off again
    isOn: true,
  });

  const rand = (min: number, max: number) => Math.random() * (max - min) + min;

  useFrame((state) => {
    const now = state.clock.getElapsedTime();

    // --- Schedule next flicker window if none scheduled yet
    if (!flicker.current.inWindow && flicker.current.nextWindowStart === 0) {
      flicker.current.nextWindowStart = now + rand(30, 60); // 30–60s
    }

    // --- Enter a flicker window?
    if (!flicker.current.inWindow && now >= flicker.current.nextWindowStart) {
      flicker.current.inWindow = true;
      flicker.current.windowEnd = now + rand(5, 6); // 3–4s window
      flicker.current.nextToggle = now;             // start flickering immediately
    }

    // --- Exit a flicker window?
    if (flicker.current.inWindow && now >= flicker.current.windowEnd) {
      flicker.current.inWindow = false;
      flicker.current.isOn = true; // restore steady light
      flicker.current.nextWindowStart = now + rand(7, 15); // 7–15s until next window
    }

    // --- Inside the window: toggle rapidly with random cadence
    if (flicker.current.inWindow && now >= flicker.current.nextToggle) {
      // ~60% chance to be OFF on a given toggle, ~40% ON
      flicker.current.isOn = Math.random() > 0.6 ? true : false;

      // Mostly very short intervals, sometimes a slightly longer blackout
      const longBlackout = Math.random() < 0.12; // 12% chance
      flicker.current.nextToggle =
        now + (longBlackout ? rand(0.18, 0.45) : rand(0.04, 0.16));
    }

    // --- Keep the light glued to the camera and looking ahead
    if (light.current) {
      light.current.position.copy(camera.position);

      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      target.current.position.copy(camera.position).add(forward.multiplyScalar(5));
      light.current.target.position.copy(target.current.position);
      light.current.target.updateMatrixWorld();

      // Compute current intensity
      let currentIntensity = baseIntensity.current;

      if (flicker.current.inWindow) {
        if (!flicker.current.isOn) {
          currentIntensity = 0; // totally off during OFF moments
        } else {
          // Slight brightness wobble even when "on" to feel electrical
          currentIntensity = baseIntensity.current * (0.75 + Math.random() * 0.35);
        }
      }

      light.current.intensity = currentIntensity;
      light.current.visible = currentIntensity > 0.01; // vanish cone when basically off
    }
  });

  return (
    <>
      <spotLight
        ref={light}
        castShadow
        intensity={intensity}
        distance={distance}
        angle={angle}
        penumbra={penumbra}
        decay={decay}
      />
      <primitive object={target.current} />
    </>
  );
}
