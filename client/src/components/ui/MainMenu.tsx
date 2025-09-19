import React, { useEffect, useMemo, useState } from "react";
import useAppStore, { GamePhase } from "../../zustand/store";
import { useStarknetConnect } from "../../dojo/hooks/useStarknetConnect";
import { useGameData } from "../../dojo/hooks/useGameData";
import { useInitializePlayer } from "../../dojo/hooks/useInitializePlayer";
import { useStartGame } from "../../dojo/hooks/useStartGame";
import { TutorialVideo } from "./TutorialVideo";

type Move = "up" | "down" | "left" | "right";

export function MainMenu(): JSX.Element {
  const { status, address, handleConnect, isConnecting } = useStarknetConnect();
  const { playerStats, isLoading: playerLoading, refetch } = useGameData();
  const {
    initializePlayer,
    isLoading: initializing,
    canInitialize,
  } = useInitializePlayer();
  const { startGame, isLoading: startingGame, canStartGame } = useStartGame();
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
    await handleConnect();
    setTimeout(() => refetch(), 1500);
  };

  const handlePlayerInit = async (): Promise<void> => {
    const res = await initializePlayer();
    if (res?.success) setTimeout(() => refetch(), 2000);
  };

  const handleStartOrEnterGame = async (): Promise<void> => {
    if (!gameAlreadyActive && canStartGame) {
      try {
        await startGame();
      } catch {}
    }
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

            {/* TUTORIAL — no functionality */}
            <button
              onClick={() => {}}
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

            {/* EXIT GAME — no functionality */}
            <button
              onClick={() => {}}
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
