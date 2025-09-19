// client/src/components/game/Gun.tsx
import { useRef, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import Pop, { PopHandle } from "../../models/Pop";
import { GunProps } from "../../types/game";
import useAppStore from "../../zustand/store";
import MuzzleFlash from "./MuzzleFlash";
import React from "react";



export function Gun({
  isVisible,           // optional (kept for compatibility)
  onShoot,
  canShoot = true,     // optional flag (UI-only gating)
}: GunProps): JSX.Element | null {
  const gunRef = useRef<THREE.Group>(null);
  const popRef = useRef<PopHandle | null>(null);
  const muzzleRef = useRef<THREE.Group>(null);
/** bump this to trigger a flash */
const [flashKick, setFlashKick] = React.useState(0);

  const { camera, scene } = useThree();

  // Get gun visibility from store
  const { showGun } = useAppStore();

  // Use store value, but allow prop override
  const shouldShow = isVisible !== undefined ? isVisible : showGun;

  // Play pickup/cock once when gun becomes visible
  const prevShowRef = useRef<boolean>(false);
  useEffect(() => {
    if (shouldShow && !prevShowRef.current) {
      popRef.current?.playPickup();
    }
    prevShowRef.current = shouldShow;
  }, [shouldShow]);

  // Timer to drive breathing motion
  const swayTime = useRef<number>(0);

  // Shooting and recoil state
  const [isRecoiling, setIsRecoiling] = useState<boolean>(false);
  const recoilTime = useRef<number>(0);
  const shootSound = useRef<HTMLAudioElement | null>(null);

  // --- Local ammo state (non-persistent) ---
  const MAG_SIZE = 6;
  const [ammoInMag,   setAmmoInMag]   = useState<number>(6);
  const [ammoReserve, setAmmoReserve] = useState<number>(10);

  // --- Reloading state (non-persistent) ---
  const [isReloading, setIsReloading] = useState(false);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // keep reserve & mag in refs for event handler closures
  const ammoReserveRef = useRef(ammoReserve);
  useEffect(() => { ammoReserveRef.current = ammoReserve; }, [ammoReserve]);

  const ammoMagRef = useRef(ammoInMag);
  useEffect(() => { ammoMagRef.current = ammoInMag; }, [ammoInMag]);

  // Broadcast reloading status to UI
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("hud:reloading", { detail: { reloading: isReloading } }));
  }, [isReloading]);

  // Cleanup any pending timer on unmount
  useEffect(() => {
    return () => { if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current); };
  }, []);

  // Broadcast ammo to HUD (no persistence)
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("hud:ammo", { detail: { mag: ammoInMag, reserve: ammoReserve } })
    );
  }, [ammoInMag, ammoReserve]);

  // Listen for external ammo awards (e.g., world pickups)
  useEffect(() => {
    const onAddAmmo = (e: Event) => {
      const ce = e as CustomEvent<{ amount?: number }>;
      const add = Math.max(0, Number(ce?.detail?.amount ?? 0));
      if (!add) return;
      setAmmoReserve((r) => r + add);
    };
    window.addEventListener("gun:addAmmo", onAddAmmo as EventListener);
    return () => window.removeEventListener("gun:addAmmo", onAddAmmo as EventListener);
  }, []);

  // Reload with explicit variant to pick the right animation
  const reload = (variant: "short" | "long" = "short"): void => {
    // guards (use refs to avoid stale reads from event handlers)
    if (isReloading) return;
    if (ammoMagRef.current >= MAG_SIZE) return;
    if (ammoReserveRef.current <= 0) return;

    setIsReloading(true);

    // Play the correct reload animation immediately
    if (variant === "short") {
      popRef.current?.playReloadShort();
    } else {
      popRef.current?.playReloadLong();
    }

    // 2s reload delay with mid-screen spinner
    reloadTimerRef.current = setTimeout(() => {
      setAmmoInMag((mPrev) => {
        // compute how many we can take
        const need = Math.max(0, MAG_SIZE - mPrev);
        const take = Math.min(need, ammoReserveRef.current);
        // apply both updates and keep refs in sync immediately
        setAmmoReserve((rPrev) => {
          const nextReserve = rPrev - take;
          ammoReserveRef.current = nextReserve;
          return nextReserve;
        });
        const nextMag = mPrev + take;
        ammoMagRef.current = nextMag;
        return nextMag;
      });
      setIsReloading(false);
    }, 2000);
  };

  // Press R to reload (short variant)
  // Listen on both window and document (PointerLock sometimes routes to document)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key?.toLowerCase?.();
      if (k === "r" || e.code === "KeyR") {
        e.preventDefault();
        reload("short"); // explicit: short/tactical reload
      }
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    document.addEventListener("keydown", onKeyDown, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKeyDown as EventListener);
      document.removeEventListener("keydown", onKeyDown as EventListener);
    };
  }, [isReloading]); // reload uses refs for ammo

  // Load sound and bind click
  // IMPORTANT: the handler does not make ammo/reload decisions — shoot() does.
  useEffect(() => {
    const audio = new Audio("/audio/shot.mp3");
    audio.volume = 0.7;
    shootSound.current = audio;

    const handleMouseClick = (event: MouseEvent) => {
      if (event.button !== 0) return;
      if (!shouldShow || !canShoot) return;
      if (isReloading) return; // block during reload
      shoot();                 // single source of truth
    };

    document.addEventListener("mousedown", handleMouseClick);
    return () => {
      document.removeEventListener("mousedown", handleMouseClick);
      shootSound.current = null;
    };
  }, [shouldShow, canShoot, isReloading]);

  const shoot = (): void => {
    if (!canShoot || isRecoiling || isReloading) return;

    // If mag is empty, either trigger long reload (if reserve) or do nothing
    if (ammoMagRef.current <= 0) {
      if (ammoReserveRef.current > 0 && !isReloading) reload("long");
      return;
    }

    // We have bullets → fire one
    setAmmoInMag((mPrev) => {
      const next = Math.max(0, mPrev - 1);
      ammoMagRef.current = next; // keep ref in sync immediately
      // if this shot empties the mag and we have reserve, auto long-reload
      if (next === 0 && ammoReserveRef.current > 0 && !isReloading) {
        reload("long");
      }
      return next;
    });

    // Sound only when a shot actually happened
    if (shootSound.current) {
      try {
        shootSound.current.currentTime = 0;
        shootSound.current.play();
      } catch (err) {
        console.log("Failed to play shoot sound:", err);
      }
    }

    // Kick the model's shoot animation
    popRef.current?.playShoot();

    // Raycast / hit detection (unchanged)
    const raycaster = new THREE.Raycaster();
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    raycaster.set(camera.position, direction);
    const intersects = raycaster.intersectObjects(scene.children, true);
    const validIntersects = intersects.filter((intersect: THREE.Intersection) => {
      const object = intersect.object;
      return (
        !(object as THREE.Light).isLight &&
        !(object as THREE.Camera).isCamera &&
        !gunRef.current?.children.some(
          (child: THREE.Object3D) => child === object || child.children.includes(object)
        ) &&
        (object.userData?.isEntity ||
          ((object as THREE.Mesh).geometry && (object as THREE.Mesh).material)) &&
        object.visible
      );
    });
    // trigger muzzle flash for a frame or two
setFlashKick((n) => n + 1);

    if (validIntersects.length > 0 && onShoot) {
      const hit = validIntersects[0];
      onShoot(hit, camera.position);
    }

    // Recoil animation
    setIsRecoiling(true);
    recoilTime.current = 0;
    setTimeout(() => setIsRecoiling(false), 200);
  };

  useFrame((_, delta: number) => {
    if (!gunRef.current || !shouldShow) return;

    // Breathing sway
    swayTime.current += delta;
    const swayY = Math.sin(swayTime.current * 2) * 0.01;


    
    // Base position from camera
    const gunPosition = new THREE.Vector3();
    camera.getWorldPosition(gunPosition);

    const forward = new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3(1, 0, 0);
    const down = new THREE.Vector3(0, -1, 0);

    forward.applyQuaternion(camera.quaternion);
    right.applyQuaternion(camera.quaternion);
    down.applyQuaternion(camera.quaternion);

    gunPosition.add(forward.multiplyScalar(0.5));
    gunPosition.add(right.multiplyScalar(0.3));
    gunPosition.add(down.multiplyScalar(0.2 + swayY));

    // Recoil offsets
    let recoilOffset = new THREE.Vector3();
    let recoilRotation = { x: 0, y: 0, z: 0 };

    if (isRecoiling) {
      recoilTime.current += delta;

      const recoilDuration = 0.2;
      const recoilProgress = Math.min(recoilTime.current / recoilDuration, 1);
      const eased = 1 - Math.pow(1 - recoilProgress, 3);

      const maxBackward = 0.15;
      const maxUpward = 0.08;
      const maxRot = -0.3;

      const backward = Math.sin(eased * Math.PI) * maxBackward;
      const upward = Math.sin(eased * Math.PI) * maxUpward;
      const rot = Math.sin(eased * Math.PI) * maxRot;

      recoilOffset.add(forward.clone().multiplyScalar(-backward));
      recoilOffset.add(down.clone().multiplyScalar(-upward));

      recoilRotation.x = -rot;
      recoilRotation.z = (Math.random() - 0.5) * 0.1;
    }

    // Apply final transform
    gunPosition.add(recoilOffset);
    gunRef.current.position.copy(gunPosition);

    gunRef.current.quaternion.copy(camera.quaternion);
    gunRef.current.rotateX(0.1 + recoilRotation.x);
    gunRef.current.rotateY(Math.PI); // remove this if Pop appears mirrored
    gunRef.current.rotateZ(recoilRotation.z);
  });

  if (!shouldShow) return null;

  return (<group dispose={null} visible={shouldShow}>

    <group ref={gunRef}>
      <Pop ref={popRef} />
       {/* MUZZLE ANCHOR — tweak this local offset to sit exactly at your barrel tip */}
  <group ref={muzzleRef} position={[0.05, -0.01, -0.82]}>
    <MuzzleFlash trigger={flashKick} />
  </group>
    </group>
    </group>
  );
}
