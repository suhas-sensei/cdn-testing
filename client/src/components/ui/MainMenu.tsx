import React, { useEffect, useMemo, useRef, useState } from "react";

import useAppStore, { GamePhase } from "../../zustand/store";
import { useStarknetConnect } from "../../dojo/hooks/useStarknetConnect";
import { useGameData } from "../../dojo/hooks/useGameData";
import { useInitializePlayer } from "../../dojo/hooks/useInitializePlayer";
import { useStartGame } from "../../dojo/hooks/useStartGame";
import { TutorialVideo } from "./TutorialVideo";
import { useEndGame } from "../../dojo/hooks/useEndGame";


type Move = "up" | "down" | "left" | "right";

const BGM_SRC = "/audio/mainmenu.mp3";

export function MainMenu(): JSX.Element {
  // Poll refetch until the session flag in store flips to "not active" (or timeout).
const pollRefetchUntilInactive = async (
  refetchFn: () => Promise<any>,
  maxTries = 12,
  gapMs = 350
): Promise<void> => {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  // read from zustand without re-render dependency
  const isActive = () => {
    const s = useAppStore.getState();
    // treat either UI phase ACTIVE or player.game_active as "active"
    return s.gamePhase === GamePhase.ACTIVE || Boolean(s.player?.game_active);
  };

  for (let i = 0; i < maxTries; i++) {
    await refetchFn();         // ask hooks to reload latest on-chain state
    await sleep(gapMs);        // let state propagate to store/UI
    if (!isActive()) return;   // stop as soon as it’s inactive
  }
};

    // BGM refs/state
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const [bgmReady, setBgmReady] = useState(false);
  const [bgmPlaying, setBgmPlaying] = useState(false);

  // Prepare and aggressively autoplay on page load
  useEffect(() => {
    const a = new Audio(BGM_SRC);
    a.loop = true;
    a.preload = "auto";
    a.volume = 0.6;
    a.crossOrigin = "anonymous";
    bgmRef.current = a;

    const onCanPlay = () => setBgmReady(true);
    a.addEventListener("canplaythrough", onCanPlay);

    let unlocked = false;

    const clearUnlockers = () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
      document.removeEventListener("visibilitychange", onVis);
    };

    const markPlaying = () => {
      if (!unlocked) {
        unlocked = true;
        setBgmPlaying(true);
        clearUnlockers();
      }
    };

    const tryAutoplay = async () => {
      if (!bgmRef.current) return;
      try {
        // Chrome allows muted autoplay; unmute after starting.
        a.muted = true;
        await a.play();
        markPlaying();
        // Unmute shortly after stable start
        setTimeout(() => {
          if (bgmRef.current) bgmRef.current.muted = false;
        }, 150);
      } catch {
        // Autoplay blocked: wait for first user gesture
      }
    };

    const unlock = () => {
      if (!bgmRef.current || unlocked) return;
      // Start with muted= false here; the gesture should permit audio
      bgmRef.current.muted = false;
      bgmRef.current.play().then(markPlaying).catch(() => void 0);
    };

    const onVis = () => {
      if (document.visibilityState === "visible" && !unlocked) {
        tryAutoplay();
      }
    };

    // Attempt immediately if visible; otherwise on first visibility
    if (document.visibilityState === "visible") {
      void tryAutoplay();
    } else {
      document.addEventListener("visibilitychange", onVis);
    }

    // Fallback unlockers if autoplay is blocked
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });

    return () => {
      clearUnlockers();
      a.removeEventListener("canplaythrough", onCanPlay);
      a.pause();
      // @ts-ignore
      bgmRef.current = null;
    };
  }, []);

  // Start on first meaningful click to satisfy autoplay policies
  const ensureBgm = async (): Promise<void> => {
    if (!bgmRef.current || bgmPlaying === true) return;
    try {
      // Some browsers require play() to be directly in a user gesture call chain
      await bgmRef.current.play();
      setBgmPlaying(true);
    } catch {}
  };

  // Fade out BGM and stop
  const stopBgmWithFade = (ms: number = 700): void => {
    const a = bgmRef.current;
    if (!a) return;
    const startVol = a.volume;
    const steps = 14;
    const step = Math.max(1, Math.floor(ms / steps));
    let i = 0;
    const id = setInterval(() => {
      i++;
      const v = Math.max(0, startVol * (1 - i / steps));
      a.volume = v;
      if (i >= steps) {
        clearInterval(id);
        a.pause();
        a.currentTime = 0;
        a.volume = startVol;
        setBgmPlaying(false);
      }
    }, step);
  };

  const { status, address, handleConnect, isConnecting } = useStarknetConnect();
  const { playerStats, isLoading: playerLoading, refetch } = useGameData();
  const {
    initializePlayer,
    isLoading: initializing,
    canInitialize,
  } = useInitializePlayer();
  const { startGame, isLoading: startingGame, canStartGame } = useStartGame();
  const { endGame, canEndGame } = useEndGame();

  const {
    setConnectionStatus,
    setLoading,
    gamePhase,
    player,
    startGame: startGameUI,
  } = useAppStore();

  const isConnected = status === "connected";
  const hasPlayerStats = playerStats !== null;
  const isLoading =
    isConnecting || playerLoading || initializing || startingGame;

  const images = useMemo(
    () => [
      "/bk1.png",
      "/bk2.png",
      "/bk3.png",
      "/bk4.png",
      "/bk5.png",
      "/bk6.png",
    ],
    []
  );
  const [bg, setBg] = useState(0);
  const [dir, setDir] = useState<Move>("up");
  const [showTutorial, setShowTutorial] = useState(false);
    const [hovered, setHovered] = useState<number | null>(null);


  useEffect(() => {
    setConnectionStatus(
      status === "connected"
        ? "connected"
        : isConnecting
        ? "connecting"
        : "disconnected"
    );
  }, [status, isConnecting, setConnectionStatus]);

  useEffect(() => setLoading(isLoading), [isLoading, setLoading]);

  // tiny ambient background swapper
  useEffect(() => {
    const t = setInterval(() => {
      setBg((b) => (b + 1) % images.length);
      setDir((d) => (d === "up" ? "down" : "up"));
    }, 5000);
    return () => clearInterval(t);
  }, [images.length]);

  const canEnterGame = isConnected && hasPlayerStats && !startingGame;
  const gameAlreadyActive =
    gamePhase === GamePhase.ACTIVE || (player as any)?.game_active;

  const handleWalletConnect = async (): Promise<void> => {
    await ensureBgm();
    await handleConnect();
    setTimeout(() => refetch(), 1500);
  };


  const handlePlayerInit = async (): Promise<void> => {
    await ensureBgm();
    const res = await initializePlayer();
    if (res?.success) setTimeout(() => refetch(), 2000);
  };


const handleStartOrEnterGame = async (): Promise<void> => {
  // Stop menu music before entering the rooms
  stopBgmWithFade(700);

  // If a previous session is still active, end it first (backend “Press B”)
  if (gameAlreadyActive && canEndGame) {
    try {
      await endGame();
    } catch {
      // ignore; proceed to refresh and start
    }

    // HARD REFRESH OF FRONTEND STATE: refetch until store no longer marks session active
    try {
      await pollRefetchUntilInactive(refetch, 12, 350);
    } catch {
      // even if polling fails, still move on
    }
  }

  // Start a fresh session if allowed
  if (canStartGame) {
    try {
      await startGame();
      // One extra refetch burst so HUD shows brand-new session values immediately
      await refetch();
      await new Promise((r) => setTimeout(r, 250));
      await refetch();
    } catch {
      // swallow; UI flow continues
    }
  }

  // Enter the 3D scene
  startGameUI();
};



    

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundImage: `url(${images[bg]})`,
        backgroundSize: "cover",
               backgroundPosition: "right center",

      }}
    >
 
          <div
        style={{
          position: "relative",
          height: "100%",
          display: "flex",
          alignItems: "stretch",
          justifyContent: "flex-start",
        }}
      >
        {/* left dark fade panel only (no full overlay) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.75) 18%, rgba(0,0,0,0.55) 32%, rgba(0,0,0,0.0) 55%)",
            pointerEvents: "none",
          }}
        />

        {/* left menu column */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            width: 920,
            padding: "396px 260px",
            display: "flex",
            flexDirection: "column",
            gap: 18,
            color: "white",
            userSelect: "none",
          }}
        >
          

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* NEW GAME — always clickable */}
            <button
              onClick={handleWalletConnect}
              style={{
                all: "unset",
                cursor: "pointer",
                fontSize: 18,
                letterSpacing: 1,
                padding: "2px 0",
              }}
            >
              <span
                style={{
                  background: "#FFFFFF",
                  color: "#000000",
                  borderRadius: 8,
                  padding: "8px 14px",
                  boxShadow: "0 2px 0 rgba(0,0,0,0.35)",
                }}
              >
                NEW GAME
              </span>
            </button>

            {/* CREATE CHARACTER — greyed until wallet connected + canInitialize */}
            <button
              onClick={handlePlayerInit}
              disabled={!isConnected || !canInitialize || initializing}
              style={{
                all: "unset",
                cursor:
                  isConnected && canInitialize && !initializing
                    ? "pointer"
                    : "not-allowed",
                fontSize: 18,
                letterSpacing: 1,
                padding: "2px 0",
                color:
                  isConnected && canInitialize && !initializing
                    ? "#FFFFFF"
                    : "rgba(255,255,255,0.45)",
              }}
            >
              CREATE CHARACTER
            </button>

            {/* ENTER THE ROOMS — greyed until flow complete */}
            <button
              onClick={handleStartOrEnterGame}
              disabled={!isConnected || !hasPlayerStats || startingGame}
              style={{
                all: "unset",
                cursor:
                  isConnected && hasPlayerStats && !startingGame
                    ? "pointer"
                    : "not-allowed",
                fontSize: 18,
                letterSpacing: 1,
                padding: "2px 0",
                color:
                  isConnected && hasPlayerStats && !startingGame
                    ? "#FFFFFF"
                    : "rgba(255,255,255,0.45)",
              }}
            >
              ENTER THE ROOMS
            </button>

                  {/* TUTORIAL — also counts as a user gesture to start BGM */}
            <button
              onClick={() => { void ensureBgm(); }}
              style={{
                all: "unset",
                cursor: "pointer",
                fontSize: 18,
                letterSpacing: 1,
                padding: "2px 0",
                color: "#FFFFFF",
              }}
            >
              TUTORIAL
            </button>


            {/* EXIT GAME */}
            <button
              onClick={() => { void ensureBgm(); /* your exit flow here */ }}
              style={{
                all: "unset",
                cursor: "pointer",
                fontSize: 18,
                letterSpacing: 1,
                padding: "2px 0",
                color: "#FFFFFF",
              }}
            >
              EXIT GAME
            </button>

          </div>
        </div>
      </div>

      {showTutorial && (
        <TutorialVideo
          onEnded={() => {
            setShowTutorial(false);
            // Now reveal the game UI
            startGameUI();
          }}
        />
      )}
    </div>
  );
}

export default MainMenu;
