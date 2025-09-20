import React, { useState, useCallback, useEffect, useRef } from "react";

import { Canvas, useFrame, useThree } from "@react-three/fiber";

import { PointerLockControls } from "@react-three/drei";
import { Vector3 } from "three";
import * as THREE from "three";
import { TransactionPopup } from "../components/ui/TransactionPopup";
import { usePlayerMovement } from "../dojo/hooks/usePlayerMovement";
import { useAttackEntity } from "../dojo/hooks/useAttackEntity";
import useAppStore, { GamePhase } from "../zustand/store";

import { MainMenu } from "../components/ui/MainMenu";
import { Crosshair } from "../components/ui/Crosshair";
import { PlayerHUD } from "../components/ui/PlayerHUD";
// import { MapTracker } from "../components/systems/MapTracker";
import { Gun } from "../components/game/Gun";
import ShotgunShoot from "../models/Shotgunshoot";

import { BloodEffect } from "../components/game/BloodEffect";
import { BulletHole } from "../components/game/BulletHole";
import { EntityCube } from "../components/game/EntityCube";
import { AudioManager } from "../components/systems/AudioManager";
import { FirstPersonControls } from "../components/systems/FirstPersonControls";
import { Model } from "../models/Bloccc";
// import NearbyDoorsComponent from "../components/ui/NearbyDoorsComponent";
import FloorGrid from "../components/game/FloorGrid";

import BlockroomsCard from "../components/ui/BlockroomsCard";
import { HUD } from "../components/ui/HUD";
import GrainVignetteOverlay from "../components/ui/GrainVignetteOverlay";
import DarknessMask from "../components/ui/DarknessMask";
import Flashlight from "../components/ui/Flashlight";
import Table from "../models/Table";
// near your other model imports
import { Ghost } from "../models/Ghost";
// import Pop, { PopHandle } from "../models/Pop";
import GhostPatrol from "../models/GhostPatrol";
import GhostPatrol2 from "../models/GhostPatrol2";
import GhostPatrol3 from "../models/GhostPatrol3";
import GhostPatrol4 from "../models/GhostPatrol4";
import GhostPatrol5 from "../models/GhostPatrol5";
import GhostPatrol6 from "../models/GhostPatrol6";
import GhostPatrol7 from "../models/GhostPatrol7";


import LightProximity from "../components/ui/LightProximity";

import { Shotgun } from "../models/Shotgun";


// Import types
import {
  BloodEffect as BloodEffectType,
  BulletHole as BulletHoleType,
} from "../types/game";
import { useOpenDoor } from "../dojo/hooks/useDoor";
import { useCollectShard } from "../dojo/hooks/useCollectShard";
import { useGameData } from "../dojo/hooks/useGameData";
import { useEndGame } from "../dojo/hooks/useEndGame";

// Door Wall Component
const DoorWall = ({  //THESE ARE DOORS WHICH ARE RED COLOURED. BEING NEAR THEM OPENS UP THE DOOR BY E AND SPAWNS THE ENTITY.
  position,
  rotation,
  doorOpening,
  doorOpened,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  doorOpening: [number, number, number];
  doorOpened: boolean;
}) => {
  return (
    <group position={position} rotation={rotation}>
      {/* Left wall section */}
      <mesh position={[-2, 1.5, 0]}>
        <boxGeometry args={[3, 3, 0.2]} />
        <meshStandardMaterial color="#612211" />
      </mesh>

      {/* Right wall section */}
      <mesh position={[2, 1.5, 0]}>
        <boxGeometry args={[2, 3, 0.2]} />
        <meshStandardMaterial color="#612211" />
      </mesh>

      {/* Top wall section (above door) */}
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[2, 1, 0.2]} />
        <meshStandardMaterial color="#612211" />
      </mesh>

      {/* Door frame - only show if door is not opened */}
      {!doorOpened && (
        <mesh position={[0, 1, 0]}>
          <boxGeometry args={[2.2, 2.2, 0.15]} />
          <meshStandardMaterial color="#B5BDA8" />
        </mesh>
      )}
    </group>
  );
};

// Center-screen raycast to know if the crosshair is on an enemy
// DONT CHANGE THIS IS JUST THE FRONTEND ENEMY.
const AimProbe = ({ onUpdate }: { onUpdate: (aiming: boolean) => void }) => {
  const { camera, scene } = useThree();
  const raycasterRef = useRef(new THREE.Raycaster());
  const center = useRef(new THREE.Vector2(0, 0)); // crosshair = screen center

  useFrame(() => {
    const ray = raycasterRef.current;
    ray.setFromCamera(center.current, camera);

    const hits = ray.intersectObjects(scene.children, true);

    // consider a hit if any intersected object (or its parent chain) has userData.isEntity
    const onEnemy = hits.some((h) => {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (o.userData && o.userData.isEntity) return true;
        o = o.parent as THREE.Object3D | null;
      }
      return false;
    });

    onUpdate(onEnemy);
  });

  return null;
};


// Force the internal WebGL buffer to 1280x720 and DPR=1.
// The canvas will still fill the screen via CSS, but it renders at 720p.
function Force720pHighPerf() {
  const { gl } = useThree();
  useEffect(() => {
    // exact 720p render buffer
    gl.setPixelRatio(1);
    gl.setSize(1280, 720, false);

    // make sure the <canvas> still fills the window (upscaled by the browser)
    const c = gl.domElement as HTMLCanvasElement;
    c.style.width = "100vw";
    c.style.height = "100vh";
    // optional: let the browser choose the best upscaler
    c.style.imageRendering = "auto";
  }, [gl]);
  return null;
}

// Left-click shooter that only affects Ghost 1 / Ghost 2
// FUNCTION TO KILL THE FE GHOST
const GhostClickShooter = ({
  ghost1Ref,
  ghost2Ref,
  enabled = true,
  onGhostShot,
}: {
  ghost1Ref: React.RefObject<THREE.Group>;
  ghost2Ref: React.RefObject<THREE.Group>;
  enabled?: boolean;
  onGhostShot: (which: 1 | 2, hit: THREE.Intersection) => void;
}) => {
  const { camera, scene } = useThree();
  const raycasterRef = useRef(new THREE.Raycaster());
  const center = useRef(new THREE.Vector2(0, 0)); // screen center

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!enabled) return;
      if (e.button !== 0) return; // only left-click

      const ray = raycasterRef.current;
      ray.setFromCamera(center.current, camera);

      const hits = ray.intersectObjects(scene.children, true);
      if (!hits.length) return;

      // find if any hit belongs under ghost1Ref or ghost2Ref
      const first = hits[0];
      let o: THREE.Object3D | null = first.object;

      const g1 = ghost1Ref.current;
      const g2 = ghost2Ref.current;

      let which: 1 | 2 | null = null;
      while (o) {
        if (g1 && o === g1) {
          which = 1;
          break;
        }
        if (g2 && o === g2) {
          which = 2;
          break;
        }
        o = o.parent as THREE.Object3D | null;
      }

      if (which) onGhostShot(which, first);
    };

    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [enabled, camera, scene, ghost1Ref, ghost2Ref, onGhostShot]);

  return null;
};

// Small glowing cubes that bob/float near where the enemy cube was
// I WILL REMOVE THIS NOT NEEDED
const ShardCluster = ({
  position,
  visible,
}: {
  position: [number, number, number];
  visible: boolean;
}) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;
    g.rotation.y += delta * 0.6; // gentle spin

    const t = state.clock.getElapsedTime();
    // bob each shard a bit differently
    g.children.forEach((child, i) => {
      const base = 0.18 + i * 0.02;
      child.position.y = base + Math.sin(t * 2 + i * 0.7) * 0.06;
    });
  });

  if (!visible) return null;

  return (
    <group ref={groupRef} position={position}>
      {/* three tiny cubes with different emissive colors */}
      <mesh position={[-0.25, 0.2, 0.15]}>
        <boxGeometry args={[0.26, 0.26, 0.26]} />
        <meshStandardMaterial
          color="#ff5a54"
          emissive="#ff5a54"
          emissiveIntensity={1.6}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0.18, 0.24, -0.2]}>
        <boxGeometry args={[0.22, 0.22, 0.22]} />
        <meshStandardMaterial
          color="#5aff7c"
          emissive="#5aff7c"
          emissiveIntensity={1.6}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0.05, 0.28, 0.25]}>
        <boxGeometry args={[0.24, 0.24, 0.24]} />
        <meshStandardMaterial
          color="#4aa8ff"
          emissive="#4aa8ff"
          emissiveIntensity={1.6}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
};

// DO NOT CHANGE
function ExposeCamera() {
  const { camera } = useThree();
  useFrame(() => {
    (window as any).__R3F_CAMERA = camera;
  });
  return null;
}
// DO NOT CHANGE
function AutoLightHoles() {
  const { scene } = useThree();
  const tmp = useRef(new THREE.Vector3());

  useFrame(() => {
    const holes: { x: number; y: number; z: number; r: number }[] = [];
    scene.traverse((obj) => {
      // Only local lights should reduce darkness
      const isSpot = (obj as any).isSpotLight;
      const isPoint = (obj as any).isPointLight;
      if (!isSpot && !isPoint) return;

      const light = obj as THREE.Light & {
        distance?: number;
        intensity: number;
      };
      obj.getWorldPosition(tmp.current);

      // Map light strength -> small world radius for DarknessMask
      // (DarknessMask multiplies 'r' by ~90px internally; keep r small)
      let r = 1.0 + (light.intensity ?? 1) * 0.12; // base
      if (isPoint) r += 0.15; // point lights a touch wider
      if (typeof light.distance === "number" && isFinite(light.distance)) {
        r += Math.min(1.0, light.distance / 120); // gentle widen with distance
      }

      holes.push({ x: tmp.current.x, y: tmp.current.y, z: tmp.current.z, r });
    });

    (window as any).__LIGHT_HOLES = holes; // DarknessMask will read this
  });

  return null;
}
// DO NOT CHANGE, CLEARS CLIENT STORAGE AFTER PRESSING B
async function clearClientStorage(): Promise<void> {
  try {
    // Web Storage
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}

    // Cache Storage (service worker caches)
    if ("caches" in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch {}
    }

    // IndexedDB (delete all known DBs; databases() not on all browsers)
    if ("indexedDB" in window) {
      try {
        const anyIDB = indexedDB as any;
        if (anyIDB.databases) {
          const dbs = await anyIDB.databases();
          await Promise.all(
            (dbs || [])
              .filter((d: any) => d?.name)
              .map(
                (d: any) =>
                  new Promise<void>((resolve) => {
                    const req = indexedDB.deleteDatabase(d.name);
                    req.onsuccess = () => resolve();
                    req.onerror = () => resolve();
                    req.onblocked = () => resolve();
                  })
              )
          );
        }
        // If .databases() doesn’t exist, we can’t enumerate names safely—skip.
      } catch {}
    }

    // Service Workers (optional, if you want a truly clean slate)
    if ("serviceWorker" in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      } catch {}
    }

    // Cookies (non-HttpOnly only)
    try {
      const raw = document.cookie;
      if (raw) {
        const parts = raw.split(";"); // "name=value"
        const paths = ["/", location.pathname.split("/").slice(0, 2).join("/") || "/"];
        const domains = [
          location.hostname,
          "." + location.hostname.replace(/^www\./, ""),
        ];

        for (const c of parts) {
          const eq = c.indexOf("=");
          const name = (eq > -1 ? c.slice(0, eq) : c).trim();
          // Delete cookie across common path/domain variants
          for (const p of paths) {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${p}`;
            for (const d of domains) {
              document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${p}; domain=${d}`;
            }
          }
        }
      }
    } catch {}
    console.log("✅ Cleared cookies & persistent storage (where allowed by the browser).");
  } catch (e) {
    console.warn("⚠️ Failed to clear some client storage:", e);
  }
}


const App = (): JSX.Element => {
  
// DO NOT CHANGE UNNDER THIS AREA ---------------------------------------------------------------------------
    const [activeWeapon, setActiveWeapon] =
    useState<"pistol" | "shotgun">("pistol");


    useEffect(() => {
  window.dispatchEvent(new CustomEvent("hud:weapon", { detail: { weapon: activeWeapon } }));
}, [activeWeapon]);



      // === MUSIC SYSTEM (BG) ===========================================
  // Files are served from /public/audio/*.mp3
  const mapReadyRef = useRef(false);                   // Canvas created?
  const startedRef = useRef(false);                    // Music started?
  const musicElRef = useRef<HTMLAudioElement | null>(null);

  // timers
  const startTimerRef = useRef<number | null>(null);   // 10s initial delay
  const gapTimerRef = useRef<number | null>(null);     // 30s gap between tracks

  // bookkeeping
  const lastTrackRef = useRef<string | null>(null);
  const playedCountRef = useRef(0);                    // how many tracks finished
  const longPlayedRef = useRef(false);                 // long.mp3 played?
  // --- SFX (shoot & reload) ---------------------------------------------
const shotSfxRef = useRef<HTMLAudioElement | null>(null);
const pistolReloadSfxRef = useRef<HTMLAudioElement | null>(null);
const shotgunReloadSfxRef = useRef<HTMLAudioElement | null>(null);

const playShot = () => playSfx(shotSfxRef, "/audio/shot2.mp3");
const playPistolReload = () => playSfx(pistolReloadSfxRef, "/audio/shotreload.mp3");

  // Create a base <audio>, then clone per play so rapid shots can overlap
  const ensureSfx = (
    ref: React.MutableRefObject<HTMLAudioElement | null>,
    src: string,
    volume = 0.9
  ) => {
    if (!ref.current) {
      const a = new Audio(src);
      a.preload = "auto";
      a.volume = volume;
      ref.current = a;
    }
    return ref.current;
  };

  const playSfx = (
    ref: React.MutableRefObject<HTMLAudioElement | null>,
    src: string
  ) => {
    const base = ensureSfx(ref, src);
    try {
      const a = base.cloneNode(true) as HTMLAudioElement;
      a.currentTime = 0;
      void a.play();
    } catch (e) {
      console.warn("[SFX] play failed:", e);
    }
  };

  

  const bgTracksRef = useRef<string[]>([
    "/audio/music1.mp3",
    "/audio/music2.mp3",
    "/audio/music3.mp3",
    "/audio/muisc4.mp3",
  ]);
  const longTrack = "audio/long.mp3";
const pendingPlayRef = useRef(false);
const resumeHandlersAttachedRef = useRef(false);

  const clearMusicTimers = () => {
    if (startTimerRef.current) { window.clearTimeout(startTimerRef.current); startTimerRef.current = null; }
    if (gapTimerRef.current)   { window.clearTimeout(gapTimerRef.current);   gapTimerRef.current   = null; }
  };

  const stopMusic = () => {
    clearMusicTimers();
    const a = musicElRef.current;
    if (a) {
      try { a.pause(); } catch {}
      a.src = "";
      try { a.load(); } catch {}
    }
    musicElRef.current = null;
    startedRef.current = false;
    playedCountRef.current = 0;
    longPlayedRef.current = false;
    lastTrackRef.current = null;
  };

  const pickRandomShortTrack = (): string => {
    const list = bgTracksRef.current;
    const candidates = list.filter((t) => t !== lastTrackRef.current);
    const pool = candidates.length ? candidates : list; // fallback if all same
    const idx = Math.floor(Math.random() * pool.length);
    return pool[idx];
  };

const playTrack = (src: string) => {
  let a = musicElRef.current;

  // Create once; reuse forever
  if (!a) {
    a = new Audio();
    a.preload = "auto";
    a.loop = false;
    a.volume = 0.35;

    a.onerror = (ev) => {
      console.error("[BG-MUSIC] audio error for", a?.src, ev);
    };

    a.onended = () => {
      playedCountRef.current += 1;
      lastTrackRef.current = a?.src || null;
      console.log("[BG-MUSIC] ended:", lastTrackRef.current, "playedCount =", playedCountRef.current);
      console.log("[BG-MUSIC] waiting 30s before next…");
      gapTimerRef.current = window.setTimeout(() => {
        scheduleNextTrack();
      }, 30_000);
    };

    musicElRef.current = a;
  } else {
    try { a.pause(); } catch {}
  }

  a.currentTime = 0;
  a.src = src;
  console.log("[BG-MUSIC] trying to play:", src);

  a.play().then(() => {
    console.log("[BG-MUSIC] playing:", src);
    pendingPlayRef.current = false;
  }).catch((err) => {
    console.warn("[BG-MUSIC] play blocked (autoplay). Will resume on next gesture.", err);
    pendingPlayRef.current = true;
  });
};


  const scheduleNextTrack = () => {
    let next: string;
    // After more than 2 tracks have played (i.e., 3rd finished), play long.mp3 once
    if (!longPlayedRef.current && playedCountRef.current >= 3) {
      next = longTrack;
      longPlayedRef.current = true;
    } else {
      next = pickRandomShortTrack();
    }
    playTrack(next);
  };

  const maybeStartMusic = () => {
    if (startedRef.current || !mapReadyRef.current) return;
    startedRef.current = true;
    // 10s after map (Canvas) is ready
    startTimerRef.current = window.setTimeout(() => {
      scheduleNextTrack();
    }, 10_000);
  };

  useEffect(() => {
  if (resumeHandlersAttachedRef.current) return;

  const resume = () => {
    if (!pendingPlayRef.current) return;
    const a = musicElRef.current;
    if (!a) return;
    a.play().then(() => {
      console.log("[BG-MUSIC] resumed via global gesture");
      pendingPlayRef.current = false;
    }).catch((e) => console.warn("[BG-MUSIC] global resume failed:", e));
  };

  window.addEventListener("pointerdown", resume, true);
  window.addEventListener("mousedown",  resume, true);
  window.addEventListener("click",       resume, true);
  window.addEventListener("touchstart",  resume, { capture: true, passive: true } as any);
  window.addEventListener("keydown",     resume, true);

  resumeHandlersAttachedRef.current = true;
  return () => {
    window.removeEventListener("pointerdown", resume, true);
    window.removeEventListener("mousedown",  resume, true);
    window.removeEventListener("click",       resume, true);
    window.removeEventListener("touchstart",  resume, { capture: true } as any);
    window.removeEventListener("keydown",     resume, true);
    resumeHandlersAttachedRef.current = false;
  };
}, []);

  // ========================================================================TILL HERE DO NOT CHANGE



  // THIS IS WHERE THE FUCKERY STARTS :)
  // IMPORTANT: All hooks must be called unconditionally at the top
  // Get game session state, UI state, and player state from Zustand store
  const [doorOpened, setDoorOpened] = useState<boolean>(false); // Room 1 doors (1 & 2)
  const [door2Opened, setDoor2Opened] = useState<boolean>(false); // Room 2 doors (3 & 4)
  const [door3Opened, setDoor3Opened] = useState<boolean>(false); // Doors 5 & 6
  const [door4Opened, setDoor4Opened] = useState<boolean>(false);
  const [door5Opened, setDoor5Opened] = useState<boolean>(false); // Room 5 (doors 8 & 9)
  const [door6Opened, setDoor6Opened] = useState<boolean>(false); // Room 6 (doors 10 & 11)
  const [door7Opened, setDoor7Opened] = useState<boolean>(false); // Room 7 (doors 12 & 13)
  // const [door8Opened, setDoor8Opened] = useState<boolean>(false);   // Room 8 (doors 14 & 15)
  // const [door9Opened, setDoor9Opened] = useState<boolean>(false);   // Room 9 (doors 16 & 17)

  const {
    gameStarted,
    showGun,
    showCrosshair,
    showMapTracker,
    position: playerPosition,
    rotation: playerRotation,
    connectionStatus,
    player,
    currentRoom,
    gamePhase,
    updatePosition,
    updateRotation,
    entities,
  } = useAppStore();
// THESE BELOW ARE FE GHOSTS========================================================
  // const popRef = useRef<PopHandle | null>(null);
  // Refs for click-detection wrappers around the ghosts
  const ghost1Ref = useRef<THREE.Group | null>(null);
  const ghost2Ref = useRef<THREE.Group | null>(null);
  const ghost3Ref = useRef<THREE.Group | null>(null);
  const ghost4Ref = useRef<THREE.Group | null>(null);
  const ghost5Ref = useRef<THREE.Group | null>(null);
  const ghost6Ref = useRef<THREE.Group | null>(null);
  const ghost7Ref = useRef<THREE.Group | null>(null);

  // Local HP counters (3 hits to kill)
  const [ghost1Hits, setGhost1Hits] = useState(0);
  const [ghost2Hits, setGhost2Hits] = useState(0);
  const [ghost1Dead, setGhost1Dead] = useState(false);
  const [ghost2Dead, setGhost2Dead] = useState(false);
  const [ghost3Dead, setGhost3Dead] = useState(false);
  const [ghost4Dead, setGhost4Dead] = useState(false);
  const [ghost5Dead, setGhost5Dead] = useState(false);
  const [ghost6Dead, setGhost6Dead] = useState(false);
  const [ghost7Dead, setGhost7Dead] = useState(false);

  // --- Ghost spawn gating --- (v2)

  const GHOST4 = { x: 294, z: 346, radius: 10 };
  const GHOST7 = { x: 402, z: 322, radius: 10 };

  const [ghost1Spawned, setGhost1Spawned] = useState(false);
  const [ghost2Spawned, setGhost2Spawned] = useState(false);
  const [ghost3Spawned, setGhost3Spawned] = useState(false);
  const [ghost4Spawned, setGhost4Spawned] = useState(false);
  const [ghost7Spawned, setGhost7Spawned] = useState(false);
  const [ghostsPreloaded, setGhostsPreloaded] = useState(false);






  const nearGhost4 =
    Math.hypot(playerPosition.x - GHOST4.x, playerPosition.z - GHOST4.z) <=
    GHOST4.radius;

 

  const nearGhost7 =
    Math.hypot(playerPosition.x - GHOST7.x, playerPosition.z - GHOST7.z) <=
    GHOST7.radius;

useEffect(() => {
  if (ghostsPreloaded && !ghost1Spawned) setGhost1Spawned(true);
}, [ghostsPreloaded, ghost1Spawned]);

useEffect(() => {
  if (ghostsPreloaded && !ghost2Spawned) setGhost2Spawned(true);
}, [ghostsPreloaded, ghost2Spawned]);


  useEffect(() => {
    if (ghostsPreloaded && !ghost3Spawned) setGhost3Spawned(true);
  }, [ghostsPreloaded, ghost3Spawned]);
  useEffect(() => {
    if (!ghost4Spawned && nearGhost4) setGhost4Spawned(true);
  }, [nearGhost4, ghost4Spawned]);



  useEffect(() => {
    if (ghostsPreloaded && !ghost7Spawned) setGhost7Spawned(true);
  }, [ghostsPreloaded, ghost7Spawned]);;

  // First pickup: equip gun only (no ammo), at (399, 392)
  const FIRST_PICKUP = { x: 399, z: 392 };
  const [firstPickupTaken, setFirstPickupTaken] = useState(false);

  // within RANGE of first pickup, and gun not yet shown
  const isNearFirstPickup =
    !showGun &&
    !firstPickupTaken &&
    Math.abs(playerPosition.x - FIRST_PICKUP.x) <= 2.0 &&
    Math.abs(playerPosition.z - FIRST_PICKUP.z) <= 2.0;

  // --- Gun pickups (session-local; non-persistent) ---
  type Pickup = { id: "P1" | "P2" | "P3"; x: number; z: number };
  const PICKUPS: Pickup[] = [
    { id: "P1", x: 350, z: 392 },
    { id: "P2", x: 369, z: 277 },
    { id: "P3", x: 338, z: 322 },
  ];

  const [pickupTaken, setPickupTaken] = useState<Record<Pickup["id"], boolean>>(
    {
      P1: false,
      P2: false,
      P3: false,
    }
  );

  const PICK_RANGE = 2.0;
  const activePickup = (() => {
    for (const p of PICKUPS) {
      if (pickupTaken[p.id]) continue;
      if (
        Math.abs(playerPosition.x - p.x) <= PICK_RANGE &&
        Math.abs(playerPosition.z - p.z) <= PICK_RANGE
      )
        return p;
    }
    return null;
  })();
// UPTIL HERE NOT CHANGE==============================================================================================
// AGAIN SOME FUCKERY BELOW
  const {
    showTransactionPopup,
    transactionError,
    isProcessingTransaction,
    closeTransactionPopup,
  } = usePlayerMovement();
  const { isLoading, enterDoor, exitDoor } = useOpenDoor();
  const { attackEntity } = useAttackEntity();
  const { collectShard } = useCollectShard();
  const { refetch: refetchGameData } = useGameData();

  // Track shard collection per room (session-local UI state)
  const [room1ShardCollected, setRoom1ShardCollected] = useState(false);
  const [room2ShardCollected, setRoom2ShardCollected] = useState(false);
  const [room3ShardCollected, setRoom3ShardCollected] = useState(false); // shard for room 3
  const [room4ShardCollected, setRoom4ShardCollected] = useState(false); // shard for room 4
  const [room5ShardCollected, setRoom5ShardCollected] = useState(false); // shard for room 5
  const [room6ShardCollected, setRoom6ShardCollected] = useState(false); // shard for room 6
  const [room7ShardCollected, setRoom7ShardCollected] = useState(false); // shard for room 7

  // State for entity cubes, THESE ARE THE ONCHAIN ENEMIES
  const [entityCubeVisible, setEntityCubeVisible] = useState<boolean>(false); // room 1
  const [cubePosition] = useState<[number, number, number]>([389, 1.5, 308]);
  const [entityCube2Visible, setEntityCube2Visible] = useState<boolean>(false); // room 2
  const [cube2Position] = useState<[number, number, number]>([343, 1.5, 299]);
  const [entityCube3Visible, setEntityCube3Visible] = useState<boolean>(false);
  const [cube3Position] = useState<[number, number, number]>([349, 1.5, 393]); // pick a spot in R3z
  const [entityCube4Visible, setEntityCube4Visible] = useState<boolean>(false);
  const [cube4Position] = useState<[number, number, number]>([322, 1.5, 372]); // spawn entity R4
  const [entityCube5Visible, setEntityCube5Visible] = useState<boolean>(false);
  const [cube5Position] = useState<[number, number, number]>([300, 1.5, 350]); // spawn entity R5
  const [entityCube6Visible, setEntityCube6Visible] = useState<boolean>(false);
  const [cube6Position] = useState<[number, number, number]>([274, 1.5, 334]); // spawn entity R6
  const [entityCube7Visible, setEntityCube7Visible] = useState<boolean>(false);
  const [cube7Position] = useState<[number, number, number]>([277, 1.5, 295]); // spawn entity R7

  // Local VFX/UI state, CONTAINS SOME FE, REST E,X,Q AND B ARE THE ONCHAIN FUNCTIONS
  const [aimingAtEntity, setAimingAtEntity] = useState(false);

  const [bulletHoles, setBulletHoles] = useState<BulletHoleType[]>([]);
  const [bloodEffects, setBloodEffects] = useState<BloodEffectType[]>([]);
  const [ePressed, setEPressed] = useState<boolean>(false);
  const [fPressed, setFPressed] = useState<boolean>(false);
  const [showShootPrompt, setShowShootPrompt] = useState<boolean>(false);

  const [xPressed, setXPressed] = useState<boolean>(false);
  const [showShardPrompt, setShowShardPrompt] = useState<boolean>(false);
  const [shardPromptKey, setShardPromptKey] = useState<number>(0);
  const [qPressed, setQPressed] = useState<boolean>(false);
  const [bPressed, setBPressed] = useState<boolean>(false);

const [canEndGame, setCanEndGame] = useState<boolean>(true);

  const [showExitPrompt, setShowExitPrompt] = useState<boolean>(false);
  const [exitPromptKey, setExitPromptKey] = useState<number>(0);
  const [shootPanelEnabled, setShootPanelEnabled] = useState<boolean>(false);
  const [shardPanelEnabled, setShardPanelEnabled] = useState<boolean>(false);
  const [exitPanelEnabled, setExitPanelEnabled] = useState<boolean>(false);
  const [promptKey, setPromptKey] = useState<number>(0);

  const { endGame } = useEndGame();

  // Reloading HUD state from Gun.tsx events, NO CHANGES SER
  const [isReloadingHud, setIsReloadingHud] = useState(false);
    // When a reload starts, play a one-shot SFX
useEffect(() => {
  if (!isReloadingHud) return;
  if (activeWeapon === "shotgun") {
    playShotgunReload();
  } else {
    playPistolReload();
  }
}, [isReloadingHud, activeWeapon]);

// A LITTLE CONFUSION HERE
  useEffect(() => {
    const onRel = (e: Event) => {
      const ce = e as CustomEvent<{ reloading: boolean }>;
      setIsReloadingHud(!!ce.detail?.reloading);
    };
    window.addEventListener("hud:reloading", onRel as EventListener);
    return () =>
      window.removeEventListener("hud:reloading", onRel as EventListener);
  }, []);
  // Initialize player position at map center on component mount
  useEffect(() => {
    const mapCenterPosition = new Vector3(400, 1.5, 400);
    updatePosition(mapCenterPosition);
  }, [updatePosition]);
// FUCKERY FUCKERY FUCKERY
  // Room 1: hide cube when entity dies (open is gated to Q+shard)
  useEffect(() => {
    if (entityCubeVisible) {
      const entity = entities.filter((e) => e.room_id.toString() === "1");
      if (entity.length > 0) {
        const target = entity[0];
        if (!target.is_alive || Number(target.health) <= 0) {
          console.log("Room 1 entity died, hiding cube");
          setEntityCubeVisible(false);
          setShootPanelEnabled(false);
          if (!room1ShardCollected) setShardPanelEnabled(true); // enable only if not collected yet
        } else {
          setShardPanelEnabled(false);
        }
      }
    }
  }, [entities, entityCubeVisible, room1ShardCollected]);

  // Room 2: hide cube when entity dies
  useEffect(() => {
    if (!entityCube2Visible) return;
    const entity = entities.filter((e) => e.room_id.toString() === "2");
    if (entity.length > 0) {
      const target = entity[0];
      if (!target.is_alive || Number(target.health) <= 0) {
        console.log("Room 2 entity died, hiding cube");
        setEntityCube2Visible(false);
        setShootPanelEnabled(false);
        if (!room2ShardCollected) setShardPanelEnabled(true);
      } else {
        setShardPanelEnabled(false);
      }
    }
    // NOTE: if list is empty temporarily after enterDoor, do nothing
  }, [entities, entityCube2Visible, room2ShardCollected]);

  // Room 3: hide cube when entity dies
  useEffect(() => {
    if (!entityCube3Visible) return;
    const entity = entities.filter((e) => e.room_id.toString() === "3");
    if (entity.length > 0) {
      const target = entity[0];
      if (!target.is_alive || Number(target.health) <= 0) {
        console.log("Room 3 entity died, hiding cube");
        setEntityCube3Visible(false);
        setShootPanelEnabled(false);
        if (!room3ShardCollected) setShardPanelEnabled(true);
      } else {
        setShardPanelEnabled(false);
      }
    }
    // NOTE: if list is empty temporarily after enterDoor, do nothing
  }, [entities, entityCube3Visible, room3ShardCollected]);

  // Room 4: hide cube when entity dies
  useEffect(() => {
    if (!entityCube4Visible) return;
    const entity = entities.filter((e) => e.room_id.toString() === "4");
    if (entity.length > 0) {
      const target = entity[0];
      if (!target.is_alive || Number(target.health) <= 0) {
        console.log("Room 4 entity died, hiding cube");
        setEntityCube4Visible(false);
        setShootPanelEnabled(false);
        if (!room4ShardCollected) setShardPanelEnabled(true);
      } else {
        setShardPanelEnabled(false);
      }
    }
    // NOTE: if list is empty temporarily after enterDoor, do nothing
  }, [entities, entityCube4Visible, room4ShardCollected]);

  // Room 5: hide cube when entity dies
  useEffect(() => {
    if (!entityCube5Visible) return;
    const entity = entities.filter((e) => e.room_id.toString() === "5");
    if (entity.length > 0) {
      const target = entity[0];
      if (!target.is_alive || Number(target.health) <= 0) {
        console.log("Room 5 entity died, hiding cube");
        setEntityCube5Visible(false);
        setShootPanelEnabled(false);
        if (!room5ShardCollected) setShardPanelEnabled(true);
      } else {
        setShardPanelEnabled(false);
      }
    }
    // NOTE: if list is empty temporarily after enterDoor, do nothing
  }, [entities, entityCube5Visible, room5ShardCollected]);

  // Room 6: hide cube when entity dies
  useEffect(() => {
    if (!entityCube6Visible) return;
    const entity = entities.filter((e) => e.room_id.toString() === "6");
    if (entity.length > 0) {
      const target = entity[0];
      if (!target.is_alive || Number(target.health) <= 0) {
        console.log("Room 6 entity died, hiding cube");
        setEntityCube6Visible(false);
        setShootPanelEnabled(false);
        if (!room6ShardCollected) setShardPanelEnabled(true);
      } else {
        setShardPanelEnabled(false);
      }
    }
    // NOTE: if list is empty temporarily after enterDoor, do nothing
  }, [entities, entityCube6Visible, room6ShardCollected]);

  // Room 7: hide cube when entity dies
  useEffect(() => {
    if (!entityCube7Visible) return;
    const entity = entities.filter((e) => e.room_id.toString() === "7");
    if (entity.length > 0) {
      const target = entity[0];
      if (!target.is_alive || Number(target.health) <= 0) {
        console.log("Room 7 entity died, hiding cube");
        setEntityCube7Visible(false);
        setShootPanelEnabled(false);
        if (!room7ShardCollected) setShardPanelEnabled(true);
      } else {
        setShardPanelEnabled(false);
      }
    }
    // NOTE: if list is empty temporarily after enterDoor, do nothing
  }, [entities, entityCube7Visible, room7ShardCollected]);
// IF THE PLAYER IS NEAR THESE COORDINATES, THE DOOR MAPPED TO THOSE COORDINATES WOULD BE ENABLED IN THE UI.
// THEN PRESS E TO ENTER AND ENTUTY SPAWNS
  // Helper: door proximity
  const isAtDoorPosition = useCallback(() => {
    const x = Math.round(playerPosition.x);
    const z = Math.round(playerPosition.z);

    // Room 1
    const atDoor1 = x >= 370 && x <= 374 && z >= 305 && z <= 308;
    const atDoor2 = x >= 382 && x <= 387 && z >= 324 && z <= 328;

    // Room 2
    const atDoor3 = x >= 350 && x <= 360 && z >= 290 && z <= 300;
    const atDoor4 = x >= 335 && x <= 345 && z >= 290 && z <= 300;

    // Room 3 (frontend coords; "y" == z)
    const atDoor5 = x >= 363 && x <= 370 && z >= 398 && z <= 405;
    const atDoor6 = x >= 363 && x <= 364 && z >= 367 && z <= 370;

    // Room 4
    const atDoor7 = x >= 323 && x <= 324 && z >= 358 && z <= 359;

    // Room 5
    const atDoor8 = x >= 303 && x <= 304 && z >= 349 && z <= 350;
    const atDoor9 = x >= 288 && x <= 289 && z >= 377 && z <= 378;
    //this is correct and works

    // Room 6  (doors 10, 11)
    const atDoor10 = x >= 278 && x <= 282 && z >= 347 && z <= 349; // include 282 (281.5 → 282)
    const atDoor11 = x >= 269 && x <= 274 && z >= 320 && z <= 322;
    //this is showing room5 in ui and gql --> must be room6

    // Room 7
    const atDoor12 = x >= 275 && x <= 278 && z >= 281 && z <= 283;
    const atDoor13 = x >= 281 && x <= 283 && z >= 308 && z <= 311;
    //this is showing room6 in ui and gql --> must be room7

    return {
      atDoor1,
      atDoor2,
      atDoor3,
      atDoor4,
      atDoor5,
      atDoor6,
      atDoor7,
      atDoor8,
      atDoor9,
      atDoor10,
      atDoor11,
      atDoor12,
      atDoor13,
      atAnyDoor:
        atDoor1 ||
        atDoor2 ||
        atDoor3 ||
        atDoor4 ||
        atDoor5 ||
        atDoor6 ||
        atDoor7 ||
        atDoor8 ||
        atDoor9 ||
        atDoor10 ||
        atDoor11 ||
        atDoor12 ||
        atDoor13,
    };
  }, [playerPosition]);

  // Helper: Resolve the active room id from store.currentRoom / player.current_room / door proximity
  // "1" | "2" | "3" | "4" | "5" | "6" | "7"
  const resolveRoomId = useCallback(():
    | "1"
    | "2"
    | "3"
    | "4"
    | "5"
    | "6"
    | "7" => {
    const store = useAppStore.getState();
    const cr: any = store.currentRoom;

    let id: any = cr;
    if (cr && typeof cr === "object") {
      id = cr.room_id ?? cr.id ?? cr.current_room ?? null;
    }
    if (id == null) id = store.player?.current_room ?? null;

    if (id == null) {
      const d = isAtDoorPosition();
      if (d.atDoor3 || d.atDoor4) return "2";
      if (d.atDoor5 || d.atDoor6) return "3";
      if (d.atDoor7) return "4";
      if (d.atDoor8 || d.atDoor9) return "5";
      if (d.atDoor10 || d.atDoor11) return "6";
      if (d.atDoor12 || d.atDoor13) return "7";

      return "1";
    }

    const s = String(id);
    if (s === "2") return "2";
    if (s === "3") return "3";
    if (s === "4") return "4";
    if (s === "5") return "5";
    if (s === "6") return "6";
    if (s === "7") return "7";
    return "1";
  }, [isAtDoorPosition]);

  const getActiveRoomId = useCallback(():
    | "1"
    | "2"
    | "3"
    | "4"
    | "5"
    | "6"
    | "7" => {
    const cr = currentRoom?.toString?.();
    if (
      cr === "1" ||
      cr === "2" ||
      cr === "3" ||
      cr === "4" ||
      cr === "5" ||
      cr === "6" ||
      cr === "7"
    )
      return cr as "1" | "2" | "3" | "4" | "5" | "6" | "7";
    const d = isAtDoorPosition();
    if (d.atDoor3 || d.atDoor4) return "2";
    if (d.atDoor5 || d.atDoor6) return "3";
    if (d.atDoor7) return "4";
    if (d.atDoor8 || d.atDoor9) return "5";
    if (d.atDoor10 || d.atDoor11) return "6";
    if (d.atDoor12 || d.atDoor13) return "7";
    return "1";
  }, [currentRoom, isAtDoorPosition]);

  // Key handlers DO NOT CHANGE, IT PICKS UP THE GUNS
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // T → pick up / show gun (runtime only)
      if (event.key.toLowerCase() === "t") {
        // 1) First pickup: only equips the gun at (399, 392)
        if (isNearFirstPickup) {
          useAppStore.getState().setShowGun(true);
          setFirstPickupTaken(true); // hide the first pickup's asset/prop if you guard it
          return;
        }

        // 2) Other pickups: grant +10 reserve and hide that pickup
        const p = activePickup;
        if (p) {
          // NOTE: these are the three ammo pickups you already defined
          window.dispatchEvent(
            new CustomEvent("gun:addAmmo", { detail: { amount: 10 } })
          );
          setPickupTaken((prev) => ({ ...prev, [p.id]: true }));
          return;
        }

        return;
      }

      // 1/2 → switch weapons (pistol / shotgun)
      if (event.key === "1") {
        // Only switch if the gun is visible/equipped
        if (useAppStore.getState().showGun) setActiveWeapon("pistol");
        window.dispatchEvent(new CustomEvent("hud:weapon", { detail: { weapon: "pistol" } }));

        return;
      }
      if (event.key === "2") {
        if (useAppStore.getState().showGun) setActiveWeapon("shotgun");
        window.dispatchEvent(new CustomEvent("hud:weapon", { detail: { weapon: "shotgun" } }));

        return;
      }


      // ENTER a door with E (unchanged), SOME FUCKERY HERE
      if (event.key.toLowerCase() === "e" && !isLoading) {
        const doorCheck = isAtDoorPosition();

        if (!doorCheck.atAnyDoor) {
          console.log("❌ Not at door position. Current:", {
            x: Math.round(playerPosition.x),
            z: Math.round(playerPosition.z),
          });
          console.log("Door 1: X=370-374, Z=305-308");
          console.log("Door 2: X=382-387, Z=324-328");
          console.log("Door 3: X=350-360, Z=290-300");
          console.log("Door 4: X=335-345, Z=290-300");
          return;
        }

        setEPressed(true);

        // Determine door id by position
        let doorId = "1";
        if (doorCheck.atDoor2) doorId = "2";
        else if (doorCheck.atDoor3) doorId = "3";
        else if (doorCheck.atDoor4) doorId = "4";
        else if (doorCheck.atDoor5) doorId = "5";
        else if (doorCheck.atDoor6) doorId = "6";
        else if (doorCheck.atDoor7) doorId = "7";
        else if (doorCheck.atDoor8) doorId = "8";
        else if (doorCheck.atDoor9) doorId = "9";
        else if (doorCheck.atDoor10) doorId = "10";
        else if (doorCheck.atDoor11) doorId = "11";
        else if (doorCheck.atDoor12) doorId = "12";
        else if (doorCheck.atDoor13) doorId = "13";

        enterDoor(doorId)
        
          .then((result) => {
            if (result.success) 
              {
              console.log(`Door ${doorId} opened successfully...`);
              setCanEndGame(false); // disable "B" until we exit via Q


              // Map door -> room
              const targetRoomId =
                doorId === "3" || doorId === "4"
                  ? "2"
                  : doorId === "5" || doorId === "6"
                  ? "3"
                  : doorId === "7"
                  ? "4"
                  : doorId === "8" || doorId === "9"
                  ? "5"
                  : doorId === "10" || doorId === "11"
                  ? "6"
                  : doorId === "12" || doorId === "13"
                  ? "7"
                  : "1";

              if (targetRoomId === "1") {
                setDoorOpened(true);
                setTimeout(() => setEntityCubeVisible(true), 1000);
              } else if (targetRoomId === "2") {
                setDoor2Opened(true);
                setTimeout(() => setEntityCube2Visible(true), 1000);
              } else if (targetRoomId === "3") {
                setDoor3Opened(true);
                setTimeout(() => setEntityCube3Visible(true), 1000);
              } else if (targetRoomId === "4") {
                setDoor4Opened(true);
                setTimeout(() => setEntityCube4Visible(true), 1000);
              } else if (targetRoomId === "5") {
                setDoor5Opened(true);
                setTimeout(() => setEntityCube5Visible(true), 1000);
              } else if (targetRoomId === "6") {
                setDoor6Opened(true);
                setTimeout(() => setEntityCube6Visible(true), 1000);
              } else if (targetRoomId === "7") {
                setDoor7Opened(true);
                setTimeout(() => setEntityCube7Visible(true), 1000);
              }

              setShardPanelEnabled(false); // shard stays disabled until kill
              setExitPanelEnabled(false); // exit stays disabled until shard is collected
              setShootPanelEnabled(true); // (ensure F panel is enabled on entry)
            } else {
              console.error("Failed to open door:", result.error);
            }
          })
          .catch((error) => console.error("Door opening error:", error));

        setTimeout(() => setEPressed(false), 1000);
        setTimeout(() => {
          refetchGameData();
        }, 1200);
      }
if (event.key.toLowerCase() === "b") {
  if (!canEndGame) {
    // ignore B while between E (entered) and Q (exited)
    return;
  }
  setBPressed(true);

  // 🔥 Clear browser cookies & persistent storage immediately on B
  clearClientStorage();

  const gameState = useAppStore.getState();
  if (gameState.player && gameState.currentRoom) {
    console.log(`🏠 End the game`);
  }

  endGame()
    .then((result) => {
      if (result.success) {
        stopMusic(); // 💡 stop bg music when game session ends
        console.log(`Ended game successfully`);
      } else {
        console.error("Failed to exit door:", result.error);
      }
    })

    .catch((error) => {
      console.error("Door exit error:", error);
    });

  setTimeout(() => setBPressed(false), 1000);
}


      // SHOOT with F — FIXED to use currentRoom (not door proximity)
      // Handle F key press for shooting (use currentRoom from GraphQL/store)
      // Handle F key press for shooting (normalize room id)
       // SHOOT with F — disabled. Attacks now come from shotgun left-click hits.


       // YES IF YOU EQUIPB THE SHOTGUN AND SHOOT, IT DOES THE F FUNCTION WE USED TO HAVE
      if (event.key.toLowerCase() === "f") {
        return;
      }


      // COLLECT shard with X — FIXED to use currentRoom (not door proximity)
      // Handle X key press for shard collection (normalize room id)
      if (event.key.toLowerCase() === "x") {
        if (!shardPanelEnabled) return; // 🚫 ignore when panel is disabled
        setXPressed(true);

        const store = useAppStore.getState();
        const shardLocations = store.shardLocations ?? []; // ✅ add this

        const targetRoomId = resolveRoomId();

        const shard = shardLocations.filter(
          (s: any) => String(s.room_id) === targetRoomId
        );
        const shardId = shard[0]?.shard_id?.toString() || "";

        if (!shardId) {
          console.warn(`No shard found in room ${targetRoomId}`);
          setTimeout(() => setXPressed(false), 200);
          return;
        }

        collectShard(shardId).then((result) => {
          if (result.success) {
            console.log("✅ Shard collected");
            if (targetRoomId === "1") setRoom1ShardCollected(true);
            else if (targetRoomId === "2") setRoom2ShardCollected(true);
            else if (targetRoomId === "3") setRoom3ShardCollected(true);
            else if (targetRoomId === "4") setRoom4ShardCollected(true);
            else if (targetRoomId === "5") setRoom5ShardCollected(true);
            else if (targetRoomId === "6") setRoom6ShardCollected(true);
            else setRoom7ShardCollected(true);

            setExitPanelEnabled(true);
            setShardPanelEnabled(false);
            refetchGameData();
          }
        });

        setTimeout(() => setXPressed(false), 200);
      }

      // EXIT + open-and-keep-open via Q (unchanged logic, now works for both rooms)
      if (event.key.toLowerCase() === "q") {
        if (!exitPanelEnabled) return; // 🚫 ignore when panel is disabled
        setQPressed(true);

        const roomId = resolveRoomId(); // which room we're in
        // ...

        const allEntities = useAppStore.getState().entities;
        const roomEntities = allEntities.filter(
          (e) => e.room_id.toString() === roomId
        );
        const entityDead =
          roomEntities.length === 0 ||
          roomEntities.every((e) => !e.is_alive || Number(e.health) <= 0);

        const shardCollected =
          roomId === "1"
            ? room1ShardCollected
            : roomId === "2"
            ? room2ShardCollected
            : roomId === "3"
            ? room3ShardCollected
            : roomId === "4"
            ? room4ShardCollected
            : roomId === "5"
            ? room5ShardCollected
            : roomId === "6"
            ? room6ShardCollected
            : room7ShardCollected;

        if (!entityDead || !shardCollected) {
          console.log(
            `❌ Room ${roomId}: kill entity and collect shard first, then press Q.`
          );
          setTimeout(() => setQPressed(false), 1000);
          return;
        }

        // 🔄 make sure store.currentRoom.cleared === true (required by useOpenDoor)
        refetchGameData().then(() => {
          const cleared = useAppStore.getState().currentRoom?.cleared === true;
          if (!cleared) {
            // one quick retry for indexer lag
            setTimeout(() => {
              refetchGameData().then(() => {
                const cleared2 =
                  useAppStore.getState().currentRoom?.cleared === true;
                if (!cleared2) {
                  console.warn(
                    `Cannot exit Room ${roomId} yet – room not marked cleared by chain.`
                  );
                  setTimeout(() => setQPressed(false), 1000);
                  return;
                }

                if (roomId === "1") setDoorOpened(true);
                else if (roomId === "2") setDoor2Opened(true);
                else if (roomId === "3") setDoor3Opened(true);
                else setDoor4Opened(true);

                // choose door id for exit (1→1/2, 2→3/4, 3→5/6, 4→7, 5→8/9)
                const here = isAtDoorPosition();
                let doorIdForExit: string = roomId;

                if (roomId === "1") {
                  if (here.atDoor1) doorIdForExit = "1";
                  else if (here.atDoor2) doorIdForExit = "2";
                  else doorIdForExit = "1";
                } else if (roomId === "2") {
                  if (here.atDoor3) doorIdForExit = "3";
                  else if (here.atDoor4) doorIdForExit = "4";
                  else doorIdForExit = "3";
                } else if (roomId === "3") {
                  if (here.atDoor5) doorIdForExit = "5";
                  else if (here.atDoor6) doorIdForExit = "6";
                  else doorIdForExit = "5";
                } else if (roomId === "4") {
                  doorIdForExit = "7"; // only one door
                } else if (roomId === "5") {
                  if (here.atDoor8) doorIdForExit = "8";
                  else if (here.atDoor9) doorIdForExit = "9";
                  else doorIdForExit = "8";
                } else if (roomId === "6") {
                  if (here.atDoor10) doorIdForExit = "10";
                  else if (here.atDoor11) doorIdForExit = "11";
                  else doorIdForExit = "10";
                } else if (roomId === "7") {
                  if (here.atDoor12) doorIdForExit = "12";
                  else if (here.atDoor13) doorIdForExit = "13";
                  else doorIdForExit = "12";
                }

                setExitPanelEnabled(false); // hide exit panel once used

                exitDoor(doorIdForExit)
                .then((res) => {
  if (res?.success) {
    setCanEndGame(true); // re-enable "B" after exit confirms
    refreshRoomAfterExit(roomId); // ✅ pull fresh HUD state
  }
})

                  .catch((error) =>
                    console.error("❌ Door exit error:", error)
                  );

                setTimeout(() => setQPressed(false), 1000);
              });
            }, 700);
            return;
          }

          if (roomId === "1") setDoorOpened(true);
          else if (roomId === "2") setDoor2Opened(true);
          else if (roomId === "3") setDoor3Opened(true);
          else if (roomId === "4") setDoor4Opened(true);
          else if (roomId === "5") setDoor5Opened(true);
          else if (roomId === "6") setDoor6Opened(true);
          else setDoor7Opened(true);

          // choose door id for exit (1→1/2, 2→3/4, 3→5/6, 4→7)
          const here = isAtDoorPosition();
          let doorIdForExit: string = roomId;

          if (roomId === "1") {
            if (here.atDoor1) doorIdForExit = "1";
            else if (here.atDoor2) doorIdForExit = "2";
            else doorIdForExit = "1";
          } else if (roomId === "2") {
            if (here.atDoor3) doorIdForExit = "3";
            else if (here.atDoor4) doorIdForExit = "4";
            else doorIdForExit = "3";
          } else if (roomId === "3") {
            if (here.atDoor5) doorIdForExit = "5";
            else if (here.atDoor6) doorIdForExit = "6";
            else doorIdForExit = "5";
          } else if (roomId === "4") {
            doorIdForExit = "7"; // only one door
          } else if (roomId === "5") {
            if (here.atDoor8) doorIdForExit = "8";
            else if (here.atDoor9) doorIdForExit = "9";
            else doorIdForExit = "8";
          } else if (roomId === "6") {
            if (here.atDoor10) doorIdForExit = "10";
            else if (here.atDoor11) doorIdForExit = "11";
            else doorIdForExit = "10";
          } else if (roomId === "7") {
            if (here.atDoor12) doorIdForExit = "12";
            else if (here.atDoor13) doorIdForExit = "13";
            else doorIdForExit = "12";
          }

          setExitPanelEnabled(false);

          exitDoor(doorIdForExit)
          .then((res) => {
  if (res?.success) {
    setCanEndGame(true); // re-enable "B" after exit confirms
    refreshRoomAfterExit(roomId); // keep your poller
  }
})

            .catch((error) => console.error("❌ Door exit error:", error));

          setTimeout(() => setQPressed(false), 1000);
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isLoading,
    enterDoor,
    exitDoor,
    attackEntity,
    collectShard,
    isAtDoorPosition,
    getActiveRoomId,
    resolveRoomId,
    room1ShardCollected,
    room2ShardCollected,
    room3ShardCollected,
    room4ShardCollected, // add
    room5ShardCollected, // add
    room6ShardCollected, // add
    room7ShardCollected, // add
    playerPosition,
    shootPanelEnabled,
    shardPanelEnabled,
    exitPanelEnabled,
    refetchGameData,
    exitPanelEnabled,
    refetchGameData,
    aimingAtEntity,
    canEndGame,
    
  ]);

  // Keep BOTH rooms' doors open for the entire session once opened via Q.
  // I WILL CHANGE THIS LATER TO CLOSE ONCE ENTERED
  useEffect(() => {
    // Intentionally no-op (no auto-close)
  }, [playerPosition, isAtDoorPosition, doorOpened, door2Opened]);
  // After exiting a room, poll a few times so HUD (Current Room) updates
  const refreshRoomAfterExit = useCallback(
    async (prevRoomId: string) => {
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 500));
        await refetchGameData();
        const st = useAppStore.getState();
        const cr =
          st.currentRoom?.toString?.() ??
          st.player?.current_room?.toString?.() ??
          "";
        if (cr && cr !== prevRoomId) break; // room changed -> stop polling
      }
    },
    [refetchGameData]
  );

  // Pass-through to store
  const handlePositionUpdate = useCallback(
    (position: Vector3): void => {
      updatePosition(position);
    },
    [updatePosition]
  );
  const handleRotationUpdate = useCallback(
    (rotation: number): void => {
      updateRotation(rotation);
    },
    [updateRotation]
  );

  // DO NOT CHANGE
  // Handle a successful left-click hit on ghost 1 or 2
  const handleGhostShot = useCallback(
    (which: 1 | 2, hit: THREE.Intersection) => {
      // Small on-screen pulse (reuses your existing prompt system)
      setShowShootPrompt(true);
      setPromptKey((k) => k + 1);
      setTimeout(() => setShowShootPrompt(false), 350);

      if (which === 1) {
        setGhost1Hits((h) => {
          const n = h + 1;
          if (n >= 3) setGhost1Dead(true);
          return n;
        });
      } else {
        setGhost2Hits((h) => {
          const n = h + 1;
          if (n >= 3) setGhost2Dead(true);
          return n;
        });
      }
// DO NOT CHANGE
      // Optional: add a little blood puff at the hit point
      if (hit?.point) {
        const bloodId = Date.now() + Math.random();
        setBloodEffects((prev) => [
          ...prev,
          { id: bloodId, position: hit.point.clone() },
        ]);
        setTimeout(() => {
          setBloodEffects((prev) => prev.filter((b) => b.id !== bloodId));
        }, 600);
      }
    },
    [setBloodEffects]
  );
// DO NOT CHANGE
  // Gun hit handling (unchanged)
   const handleGunShoot = useCallback(
    
    async (hit: THREE.Intersection, cameraPosition: Vector3): Promise<void> => {




      const hitObject = hit.object;
      const hitPoint = hit.point;
      const hitNormal = hit.face?.normal;

      // VFX (unchanged)// DO NOT CHANGE
      if (hitObject.userData?.isEntity) {
        const bloodId = Date.now() + Math.random();
        setBloodEffects((prev: BloodEffectType[]) => [
          ...prev,
          { id: bloodId, position: hitPoint.clone() },
        ]);
        setTimeout(() => {
          setBloodEffects((prev) => prev.filter((b) => b.id !== bloodId));
        }, 600);
      } else if (hitNormal) {
        const holeId = Date.now() + Math.random();
        const offsetPosition = hitPoint
          .clone()
          .add(hitNormal.clone().multiplyScalar(0.01));
        setBulletHoles((prev: BulletHoleType[]) => [
          ...prev,
          {
            id: holeId,
            position: offsetPosition,
            normal: hitNormal.clone(),
            cameraPosition: cameraPosition.clone(),
          },
        ]);
      }

    // ✅ Count as a transaction ONLY if:
      // 1) the shot actually hit an entity (flag may be on a parent),
      // 2) the active weapon is the SHOTGUN, and
      // 3) the shoot panel is currently enabled (inside a room with a target).



      // HERE THE MF ENTITY DIES AND I DID SOME FUCKERY HERE TOO
      let o: THREE.Object3D | null = hitObject;
      let entityCarrier: THREE.Object3D | null = null;
      while (o) {
        if ((o as any).userData && (o as any).userData.isEntity) {
          entityCarrier = o;
          break;
        }
        o = o.parent as THREE.Object3D | null;
      }
      if (!entityCarrier) return;
      if (activeWeapon !== "shotgun") return;
      if (!shootPanelEnabled) return;

      const store = useAppStore.getState()
      const targetRoomId = resolveRoomId();

      // Find alive target in the current room
      const targets = store.entities.filter(
        (e) => e.is_alive && e.room_id.toString() === targetRoomId
      );
      if (targets.length === 0) return;

      const entityId = targets[0].entity_id.toString();

      try {
        const result = await attackEntity(entityId);
        if (result?.success) {
          // Re-check a moment later and hide the cube / enable shard UI
          setTimeout(() => {
            const updated = useAppStore
              .getState()
              .entities.filter((e) => e.room_id.toString() === targetRoomId);

            const dead =
              updated.length === 0 ||
              !updated[0].is_alive ||
              Number(updated[0].health) <= 0;

            if (dead) {
              if (targetRoomId === "1") setEntityCubeVisible(false);
              else if (targetRoomId === "2") setEntityCube2Visible(false);
              else if (targetRoomId === "3") setEntityCube3Visible(false);
              else if (targetRoomId === "4") setEntityCube4Visible(false);
              else if (targetRoomId === "5") setEntityCube5Visible(false);
              else if (targetRoomId === "6") setEntityCube6Visible(false);
              else if (targetRoomId === "7") setEntityCube7Visible(false);

              setShootPanelEnabled(false);

              const shardAlready =
                targetRoomId === "1" ? room1ShardCollected
                : targetRoomId === "2" ? room2ShardCollected
                : targetRoomId === "3" ? room3ShardCollected
                : targetRoomId === "4" ? room4ShardCollected
                : targetRoomId === "5" ? room5ShardCollected
                : targetRoomId === "6" ? room6ShardCollected
                : room7ShardCollected;

              if (!shardAlready) setShardPanelEnabled(true);
            }
          }, 1000);

          // Pull fresh room state
          setTimeout(() => refetchGameData(), 600);
        } else {
          console.error("❌ Failed to attack entity:", result?.error);
        }
      } catch (err) {
        console.error("❌ attack entity error:", err);
      }
    },
    [
      activeWeapon,
      attackEntity,
      resolveRoomId,
      shootPanelEnabled,
      refetchGameData,
      room1ShardCollected,
      room2ShardCollected,
      room3ShardCollected,
      room4ShardCollected,
      room5ShardCollected,
      room6ShardCollected,
      room7ShardCollected,
    ]
  );

  // Remove effects helpers
  // DO NOT CHANGE
  const removeBloodEffect = useCallback((id: number): void => {
    setBloodEffects((prev) => prev.filter((b) => b.id !== id));
  }, []);
  const removeBulletHole = useCallback((id: number): void => {
    setBulletHoles((prev) => prev.filter((h) => h.id !== id));
  }, []);

  // Render gate
  // FUCKERY MAYBE
  const isConnected = connectionStatus === "connected";
  const hasPlayer = player !== null;
  const isGameActive = gamePhase === GamePhase.ACTIVE;
  const shouldShowGame =
    isConnected && hasPlayer && isGameActive && gameStarted;
  // When the game becomes visible, try to start the music flow.
  // When leaving the game (back to menu/unmount), stop music.
  useEffect(() => {
    if (shouldShowGame) {
      // Canvas may mark map ready later; we also call maybeStartMusic from onCreated.
      // If Canvas was already ready, this call will start the 10s timer immediately.
      maybeStartMusic();
      setGhostsPreloaded(true); // ✅ mark ghosts ready to spawn during loading

    } else {
      // back to menu
      stopMusic();
    }
  }, [shouldShowGame]);

  if (!shouldShowGame) return <MainMenu />;

  const activeRoomId = getActiveRoomId();

  // For UI panels
  const doorCheck = isAtDoorPosition();

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      {/* Silent audio manager - no UI */}

      <AudioManager />

      {/* Player HUD */}
      <PlayerHUD />

      {/* Transaction Popup */}
      <TransactionPopup
        isVisible={showTransactionPopup}
        isLoading={isProcessingTransaction}
        error={transactionError}
        onClose={closeTransactionPopup}
      />


  {/* Door Entry Panel */}
<div
  style={{
    position: "fixed",
    bottom: "20px",
    left: "20px",
    zIndex: 3000,
    backgroundColor: ePressed ? "rgba(255, 255, 255, 0.9)" : "rgba(0, 0, 0, 0.9)",
    border: `2px solid ${doorCheck.atAnyDoor ? "#E1CF48" : "#666"}`,
    borderRadius: "8px",
    padding: "20px",
    color: ePressed ? "black" : "white",
    fontFamily: "monospace",
    minWidth: "300px",
    textAlign: "center",
    opacity: doorCheck.atAnyDoor ? 1 : 0.5,
  }}
>
  <div
    style={{
      fontSize: "18px",
      fontWeight: "bold",
      color: doorCheck.atAnyDoor
        ? (ePressed ? "black" : "#E1CF48")
        : (ePressed ? "black" : "#666"),
    }}
  >
    Press E to Open Door
  </div>
</div>


      {/* Shooting Panel */}
      
      <div
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 3000,
          backgroundColor: fPressed
            ? "rgba(255, 255, 255, 0.9)"
            : "rgba(0, 0, 0, 0.9)",
          border: shootPanelEnabled ? "2px solid #ff4444" : "2px solid #555",
          borderRadius: "8px",
          padding: "20px",
          color: fPressed ? "black" : "white",
          fontFamily: "monospace",
          minWidth: "300px",
          textAlign: "center",
          opacity: shootPanelEnabled ? 1 : 0.45,
          pointerEvents: "none", // purely visual panel; avoid accidental hovers/clicks
        }}
      >
        <div style={{ fontSize: "18px", fontWeight: "bold" }}>
          {activeWeapon === "shotgun"
            ? "Left-click to Shoot Enemy (shotgun)"
            : "Switch to Shotgun (2) to damage enemy"}
        </div>

        {doorCheck.atAnyDoor && (
          <div style={{ marginTop: "8px", fontSize: "14px", color: "#ff6666" }}>
            {(doorCheck.atDoor1 || doorCheck.atDoor2) && "Targeting Room 1"}
            {(doorCheck.atDoor3 || doorCheck.atDoor4) && "Targeting Room 2"}
            {(doorCheck.atDoor5 || doorCheck.atDoor6) && "Targeting Room 3"}
            {doorCheck.atDoor7 && "Targeting Room 4"}
            {(doorCheck.atDoor8 || doorCheck.atDoor9) && "Targeting Room 5"}
            {(doorCheck.atDoor10 || doorCheck.atDoor11) && "Targeting Room 6"}
            {(doorCheck.atDoor12 || doorCheck.atDoor13) && "Targeting Room 7"}
          </div>
        )}
      </div>

      {/* Centered reload spinner */}
      {isReloadingHud && (
        <>
          {/* spinner keyframes once */}
          <style>{`
      @keyframes hud-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    `}</style>

          <div></div>
        </>
      )}

      {/* Shard Panel */}
      <div
        style={{
          position: "fixed",
          bottom: "120px",
          right: "20px",
          zIndex: 3000,
          backgroundColor: xPressed
            ? "rgba(255, 255, 255, 0.9)"
            : "rgba(0, 0, 0, 0.9)",
          border: shardPanelEnabled ? "2px solid #44ff44" : "2px solid #555",
          borderRadius: "8px",
          padding: "20px",
          color: xPressed ? "black" : "white",
          fontFamily: "monospace",
          minWidth: "300px",
          textAlign: "center",
          opacity: shardPanelEnabled ? 1 : 0.45,
          pointerEvents: "none", 
        }}
      >
        <div style={{ fontSize: "18px", fontWeight: "bold" }}>
          Press X to Collect Shard
        </div>
        {doorCheck.atAnyDoor && (
          <div style={{ marginTop: "8px", fontSize: "14px", color: "#66ff66" }}>
            {(doorCheck.atDoor1 || doorCheck.atDoor2) && "Targeting Room 1"}
            {(doorCheck.atDoor3 || doorCheck.atDoor4) && "Targeting Room 2"}
          </div>
        )}
      </div>
  {
  <div
    style={{
      position: "fixed",
      bottom: "320px",
      right: "20px",
      zIndex: 3000,
      backgroundColor: bPressed
        ? "rgba(255, 255, 255, 0.9)"
        : "rgba(0, 0, 0, 0.9)",
      border: canEndGame ? "2px solid #44ff44" : "2px solid #555",
      borderRadius: "8px",
      padding: "20px",
      color: bPressed ? "black" : "white",
      fontFamily: "monospace",
      minWidth: "300px",
      textAlign: "center",
      opacity: canEndGame ? 1 : 0.45,
      pointerEvents: "none", // visual panel only
    }}
  >
    {/* First equip panel (only near 399,392 until picked) */}
    {isNearFirstPickup && (
      <div
        style={{
          position: "fixed",
          bottom: "420px",
          right: "20px",
          zIndex: 3000,
          backgroundColor: "rgba(0, 0, 0, 0.9)",
          border: "2px solid #4488ff",
          borderRadius: "8px",
          padding: "20px",
          color: "white",
          fontFamily: "monospace",
          minWidth: "300px",
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <div style={{ fontSize: "18px", fontWeight: "bold" }}>
          Press T to Pick Up Gun
        </div>
        <div style={{ fontSize: "12px", opacity: 0.7, marginTop: 6 }}>
          (Stand near X:{FIRST_PICKUP.x}, Z:{FIRST_PICKUP.z})
        </div>
      </div>
    )}

    {/* Ammo pickups panel (only near an untaken ammo pickup) */}
    {!isNearFirstPickup && activePickup && (
      <div
        style={{
          position: "fixed",
          bottom: "420px",
          right: "20px",
          zIndex: 3000,
          backgroundColor: "rgba(0, 0, 0, 0.9)",
          border: "2px solid #4488ff",
          borderRadius: "8px",
          padding: "20px",
          color: "white",
          fontFamily: "monospace",
          minWidth: "300px",
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <div style={{ fontSize: "18px", fontWeight: "bold" }}>
          Press T to Collect Ammo (+10)
        </div>
        <div style={{ fontSize: "12px", opacity: 0.7, marginTop: 6 }}>
          (Stand near X:{activePickup.x}, Z:{activePickup.z})
        </div>
      </div>
    )}

    <div style={{ fontSize: "18px", fontWeight: "bold" }}>
      {canEndGame ? "Press B to End Game" : "End Game disabled while inside room"}
    </div>
  </div>
}


      {/* Exit Panel */}
      <div
        style={{
          position: "fixed",
          bottom: "220px",
          right: "20px",
          zIndex: 3000,
          backgroundColor: qPressed
            ? "rgba(255, 255, 255, 0.9)"
            : "rgba(0, 0, 0, 0.9)",
          border: exitPanelEnabled ? "2px solid #ff8844" : "2px solid #555",
          borderRadius: "8px",
          padding: "20px",
          color: qPressed ? "black" : "white",
          fontFamily: "monospace",
          minWidth: "300px",
          textAlign: "center",
          opacity: exitPanelEnabled ? 1 : 0.45,
          pointerEvents: "none", // purely visual panel
        }}
      >
        <div style={{ fontSize: "18px", fontWeight: "bold" }}>
          Press Q to Exit Game
        </div>
        {doorCheck.atAnyDoor && (
          <div style={{ marginTop: "8px", fontSize: "14px", color: "#ff8866" }}>
            {(doorCheck.atDoor1 || doorCheck.atDoor2) && "Exiting Room 1"}
            {(doorCheck.atDoor3 || doorCheck.atDoor4) && "Exiting Room 2"}
            {(doorCheck.atDoor5 || doorCheck.atDoor6) && "Exiting Room 3"}
            {(doorCheck.atDoor8 || doorCheck.atDoor9) && "Exiting Room 5"}
            {(doorCheck.atDoor10 || doorCheck.atDoor11) && "Exiting Room 6"}
            {(doorCheck.atDoor12 || doorCheck.atDoor13) && "Exiting Room 7"}
          </div>
        )}
      </div>

      {/* On-screen prompts */}
      {showShootPrompt && (
        <div
          key={promptKey}
          style={{
            position: "fixed",
            top: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 5000,
            backgroundColor: "rgba(255, 68, 68, 0.9)",
            border: "2px solid #ff6666",
            borderRadius: "8px",
            padding: "15px 25px",
            color: "white",
            fontFamily: "monospace",
            fontSize: "18px",
            fontWeight: "bold",
            textAlign: "center",
            animation: "fadeOut 1s ease-out forwards",
            boxShadow: "0 4px 12px rgba(255, 68, 68, 0.4)",
          }}
        >
          ENEMY SHOT!
        </div>
      )}
      {showShardPrompt && (
        <div
          key={shardPromptKey}
          style={{
            position: "fixed",
            top: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 5000,
            backgroundColor: "rgba(68, 255, 68, 0.9)",
            border: "2px solid #66ff66",
            borderRadius: "8px",
            padding: "15px 25px",
            color: "white",
            fontFamily: "monospace",
            fontSize: "18px",
            fontWeight: "bold",
            textAlign: "center",
            animation: "fadeOut 1s ease-out forwards",
            boxShadow: "0 4px 12px rgba(68, 255, 68, 0.4)",
          }}
        >
          SHARD COLLECTED!
        </div>
      )}

      <style>{`
        @keyframes fadeOut {
          0% { opacity: 1; transform: translateX(-50%) translateY(0px); }
          70% { opacity: 1; transform: translateX(-50%) translateY(-5px); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        }
      `}</style>

      {/* New lightweight UI overlays (purely visual) */}
      <BlockroomsCard />
      <HUD />
      <GrainVignetteOverlay
        intensity={0.14}
        fps={24}
        tint="rgba(8,6,6,0.22)"
        vignette={0.7}
      />
      <DarknessMask radiusPct={0.36} feather={220} darkness={0.96} />

      {/* Crosshair */}
      {showCrosshair && <Crosshair />}

      {/* Map Tracker (optional) */}
      {/* {showMapTracker && (
        <MapTracker
          playerPosition={playerPosition}
          playerRotation={playerRotation}
          mapScale={30}
          size={250}
        />
      )} */}

      <Canvas
       // ✅ exact 720p buffer + max perf hints
  dpr={1}
  gl={{
    powerPreference: "high-performance", // ask for discrete GPU when available
    antialias: false,        // cheaper (turn on if you really want smoother edges)
    alpha: false,            // opaque canvas = faster
    depth: true,
    stencil: false,
    preserveDrawingBuffer: false, // better perf (unless you need to read pixels / screenshots)
  }}
  frameloop="always"         // keep rendering (don’t auto-throttle)
  shadows                    // keep if you use shadows; remove for extra perf

  camera={{
  fov: 60,
  position: [400, 1.5, 400],
  near: 0.2,
  far: 1000,
}}

        onCreated={({ camera }) => {
          camera.rotation.set(0, 0, 0);
          camera.lookAt(400, 1.5, 399);
          (window as any).__R3F_CAMERA = camera; // let DarknessMask project lights

             // 🔊 mark map ready & possibly start 10s countdown
          mapReadyRef.current = true;
          maybeStartMusic();
        }}
      >
        {/* Lighting */}
        <Force720pHighPerf />

        <ambientLight intensity={0.2} color="#fff8dc" />
        <LightProximity reach={18} minA={0.06} maxA={0.96} />
        <ExposeCamera />
        <AutoLightHoles />

        <Flashlight />
        <GhostClickShooter
          ghost1Ref={ghost1Ref}
          ghost2Ref={ghost2Ref}
          enabled={true}
          onGhostShot={handleGhostShot}
        />

        <directionalLight
          position={[420, 20, 420]}
          intensity={0.8}
          color="#fff8dc"
          castShadow
        shadow-mapSize-width={1024}

shadow-mapSize-height={2048}

          shadow-camera-far={100}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={50}
          shadow-camera-bottom={-50}
        />
        <directionalLight
          position={[380, 15, 380]}
          intensity={0.4}
          color="#f4e4bc"
        />
        <pointLight
          position={[400, 10, 400]}
          intensity={0.5}
          color="#fff8dc"
          distance={100}
        />

        <FloorGrid minorStep={1} highlightStep={20} y={0.01} />
        {/* <Pop
          ref={popRef}

        /> */}
        {/* GHOST 1 */}
        {ghost1Spawned && !ghost1Dead && (
          <group ref={ghost1Ref} userData={{ isGhost: true, ghostId: 1 }}>
            <GhostPatrol
              y={1.2}
              loops={4}
              speed={2.5}
              yawOffset={-1}
              scale={1.5} // ⬅️ was 1
              // collideRadius={2.7}  // ⬅️ optional: 1.5 × 1.8 to keep spacing
            />
          </group>
        )}

        {/* GHOST 2 */}
        {ghost2Spawned && !ghost2Dead && (
          <group ref={ghost2Ref} userData={{ isGhost: true, ghostId: 2 }}>
            <GhostPatrol2
              y={0.9}
              loops={4}
              speed={2.5}
              yawOffset={-1}
              scale={1.5}
              // collideRadius={2.7}
            />
          </group>
        )}

        {/* GHOST 3 */}
        {ghost3Spawned && !ghost3Dead && (
          <group ref={ghost3Ref} userData={{ isGhost: true, ghostId: 3 }}>
            <GhostPatrol3
              y={0.9}
              loops={4}
              speed={2.5}
              yawOffset={-1}
              scale={1.5}
              // collideRadius={2.7}
            />
          </group>
        )}

        {/* GHOST 4 */}
        {ghost4Spawned && !ghost4Dead && (
          <group ref={ghost4Ref} userData={{ isGhost: true, ghostId: 4 }}>
            <GhostPatrol4
              y={0.9}
              speed={2.5}
              yawOffset={-1}
              scale={1.5}
              // collideRadius={2.7}
              onVanish={() => setGhost4Dead(true)}
            />
          </group>
        )}

        {/* GHOST 5 — spawns at game start, vanishes 5s after first seen */}
        {!ghost5Dead && (
          <group ref={ghost5Ref} userData={{ isGhost: true, ghostId: 5 }}>
            <GhostPatrol5
              y={0.9}
              speed={2.0}
              yawOffset={-1}
              scale={2} // change if you want bigger/smaller
              onVanish={() => setGhost5Dead(true)}
            />
          </group>
        )}

        {/* GHOST 6 — spawns at game start, vanishes 5s after first seen */}
        {!ghost6Dead && (
          <group ref={ghost6Ref} userData={{ isGhost: true, ghostId: 6 }}>
            <GhostPatrol6
              y={0.9}
              speed={2.0}
              yawOffset={-1}
              scale={2} // change if you want bigger/smaller
              onVanish={() => setGhost6Dead(true)}
            />
          </group>
        )}


                {/* GHOST 7 */}
        {ghost7Spawned && !ghost7Dead && (
          <group ref={ghost7Ref} userData={{ isGhost: true, ghostId: 7 }}>
            <GhostPatrol7
              y={0.9}
              speed={2.5}
              yawOffset={-1}
              scale={1.5}
              // collideRadius={2.7}
              onVanish={() => setGhost7Dead(true)}
            />
          </group>
        )}

        {/* Room 1 Doors */}
        <DoorWall
          position={[372, 0, 306.5]}
          rotation={[0, Math.PI / 2, 0]}
          doorOpening={[0, 1, 0.5]}
          doorOpened={doorOpened}
        />
        <DoorWall
          position={[384.5, 0, 326]}
          rotation={[0, 0, 0]}
          doorOpening={[0, 1, 0.5]}
          doorOpened={doorOpened}
        />

        {/* Room 2 Doors */}
        <DoorWall
          position={[355, 0, 293.5]}
          rotation={[0, Math.PI / 2, 0]}
          doorOpening={[0, 1, 0.5]}
          doorOpened={door2Opened}
        />
        <DoorWall
          position={[338, 0, 293]}
          rotation={[0, Math.PI / 2, 0]}
          doorOpening={[0, 1, 0.5]}
          doorOpened={door2Opened}
        />

        {/* Room 3 Doors */}
        <DoorWall
          position={[368, 0, 400]} // center of Door 5 range
          rotation={[0, Math.PI / 2, 0]}
          doorOpening={[0, 1, 0.5]}
          doorOpened={door3Opened}
        />
        <DoorWall
          position={[363.5, 0, 368.5]} // center of Door 6 range
          rotation={[0, Math.PI / 2, 0]}
          doorOpening={[0, 1, 0.5]}
          doorOpened={door3Opened}
        />
        {/* Room 4 Door */}
        <DoorWall
          position={[323.5, 0, 358.5]} // center of Door 7 range
          rotation={[0, 0, 0]}
          doorOpening={[0, 1, 0.5]}
          doorOpened={door4Opened}
        />
        {/* Room 5 Doors */}
        <DoorWall
          position={[303.5, 0, 349.5]}
          rotation={[0, Math.PI / 2, 0]}
          doorOpening={[0, 1, 0.5]}
          doorOpened={door5Opened}
        />
        <DoorWall
          position={[288.5, 0, 377.5]}
          rotation={[0, 0, 0]}
          doorOpening={[0, 1, 0.5]}
          doorOpened={door5Opened}
        />

        {/* Room 6 Doors */}
        <DoorWall
          position={[279, 0, 347.5]} // center of Door 10 range
          rotation={[0, 0, 0]}
          doorOpening={[0, 1, 0.5]}
          doorOpened={door6Opened}
        />
        <DoorWall
          position={[269.5, 0, 320.5]} // center of Door 11 range
          rotation={[0, Math.PI / 2, 0]}
          doorOpening={[0, 1, 0.5]}
          doorOpened={door6Opened}
        />

        {/* Room 7 Doors */}
        <DoorWall
          position={[276, 0, 281.5]} // center of Door 12 range
          rotation={[0, 0, 0]}
          doorOpening={[0, 1, 0.5]}
          doorOpened={door7Opened}
        />
        <DoorWall
          position={[276, 0, 311.5]} // center of Door 13 range
          rotation={[0, 0, 0]}
          doorOpening={[0, 1, 0.5]}
          doorOpened={door7Opened}
        />

        <AimProbe onUpdate={setAimingAtEntity} />

        {/* Pointer lock */}
        <PointerLockControls />

        {/* Controls */}
        <FirstPersonControls
          onPositionUpdate={handlePositionUpdate}
          onRotationUpdate={handleRotationUpdate}
        />

        {/* Level */}
        <Model />
        {/* Gun pickup placeholders (remove if you swap for real models) */}
        {!pickupTaken.P1 && (
          <mesh position={[350, 0.2, 392]}>
            <boxGeometry args={[0.4, 0.2, 1.0]} />
            <meshStandardMaterial
              color="#222"
              emissive="#4aa8ff"
              emissiveIntensity={0.6}
              toneMapped={false}
            />
          </mesh>
        )}
        {!pickupTaken.P2 && (
          <mesh position={[369, 0.2, 277]}>
            <boxGeometry args={[0.4, 0.2, 1.0]} />
            <meshStandardMaterial
              color="#222"
              emissive="#4aa8ff"
              emissiveIntensity={0.6}
              toneMapped={false}
            />
          </mesh>
        )}
        {!pickupTaken.P3 && (
          <mesh position={[338, 0.2, 322]}>
            <boxGeometry args={[0.4, 0.2, 1.0]} />
            <meshStandardMaterial
              color="#222"
              emissive="#4aa8ff"
              emissiveIntensity={0.6}
              toneMapped={false}
            />
          </mesh>
        )}

{!firstPickupTaken && (
  <>
    <Table position={[392, 0, 392]} />
    {/* Shotgun on top of the table; tweak Y if it clips or floats */}
    <group position={[392, 0, 392]}>
      <Shotgun
        position={[5.7, 1.1, -0.4 ]}         // height above table surface
        rotation={[0, - Math.PI / 4, -1.5]} // face it sideways for style
        scale={0.65}                   // adjust to your table size
      />
    </group>
  </>
)}

        {/* <Ghost position={[391, 0, 399]} /> */}

{/* Weapons */}
{showGun && (
  activeWeapon === "pistol" ? (
    <Gun key="pistol" isVisible={showGun} onShoot={handleGunShoot} />
  ) : (
    <ShotgunShoot key="shotgun" isVisible={showGun} onShoot={handleGunShoot} />
  )
)}


        {/* Blood effects */}
        {bloodEffects.map((effect: BloodEffectType) => (
          <BloodEffect
            key={effect.id}
            position={effect.position}
            onComplete={() => removeBloodEffect(effect.id)}
          />
        ))}

        {/* Bullet holes */}
        {/* {bulletHoles.map((hole: BulletHoleType[]) => null) /* silence TS types in map below */}
        {/* {bulletHoles.map((hole: any) => (
          <BulletHole
            key={hole.id}
            position={hole.position}
            normal={hole.normal}
            cameraPosition={hole.cameraPosition}
            onComplete={() => removeBulletHole(hole.id)}
          />
        ))} */}

        {/* Room 1 Entity Cube */}
        <EntityCube
          position={cubePosition}
          isVisible={entityCubeVisible}
          onSpawn={() => console.log("🎯 Room 1 Entity cube spawned!")}
          entityId="door_entity_1"
        />

        <ShardCluster
          position={[cubePosition[0], 1.6, cubePosition[2]]}
          visible={
            shardPanelEnabled && !room1ShardCollected && resolveRoomId() === "1"
          }
        />

        {/* Room 2 Entity Cube */}
        <EntityCube
          position={cube2Position}
          isVisible={entityCube2Visible}
          onSpawn={() => console.log("🎯 Room 2 Entity cube spawned!")}
          entityId="door_entity_2"
        />

        <ShardCluster
          position={[cube2Position[0], 1.6, cube2Position[2]]}
          visible={
            shardPanelEnabled && !room2ShardCollected && resolveRoomId() === "2"
          }
        />

        {/* Room 3 Entity Cube */}
        <EntityCube
          position={cube3Position}
          isVisible={entityCube3Visible}
          onSpawn={() => console.log("🎯 Room 3 Entity cube spawned!")}
          entityId="door_entity_3"
        />

        <ShardCluster
          position={[cube3Position[0], 1.6, cube3Position[2]]}
          visible={
            shardPanelEnabled && !room3ShardCollected && resolveRoomId() === "3"
          }
        />

        {/* Room 4 Entity Cube */}
        <EntityCube
          position={cube4Position}
          isVisible={entityCube4Visible}
          onSpawn={() => console.log("🎯 Room 4 Entity cube spawned!")}
          entityId="door_entity_4"
        />

        <ShardCluster
          position={[cube4Position[0], 1.6, cube4Position[2]]}
          visible={
            shardPanelEnabled && !room4ShardCollected && resolveRoomId() === "4"
          }
        />

        {/* Room 5 Entity Cube */}
        <EntityCube
          position={cube5Position}
          isVisible={entityCube5Visible}
          onSpawn={() => console.log("🎯 Room 5 Entity cube spawned!")}
          entityId="door_entity_5"
        />

        <ShardCluster
          position={[cube5Position[0], 1.6, cube5Position[2]]}
          visible={
            shardPanelEnabled && !room5ShardCollected && resolveRoomId() === "5"
          }
        />

        {/* Room 6 Entity Cube */}
        <EntityCube
          position={cube6Position}
          isVisible={entityCube6Visible}
          onSpawn={() => console.log("🎯 Room 6 Entity cube spawned!")}
          entityId="door_entity_6"
        />
        <ShardCluster
          position={[cube6Position[0], 1.6, cube6Position[2]]}
          visible={
            shardPanelEnabled && !room6ShardCollected && resolveRoomId() === "6"
          }
        />

        {/* Room 7 Entity Cube */}
        <EntityCube
          position={cube7Position}
          isVisible={entityCube7Visible}
          onSpawn={() => console.log("🎯 Room 7 Entity cube spawned!")}
          entityId="door_entity_7"
        />

        <ShardCluster
          position={[cube7Position[0], 1.6, cube7Position[2]]}
          visible={
            shardPanelEnabled && !room7ShardCollected && resolveRoomId() === "7"
          }
        />
      </Canvas>
    </div>
  );
};

export default App;
function playShotgunReload() {
  throw new Error("Function not implemented.");
}

