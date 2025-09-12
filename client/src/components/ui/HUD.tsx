import React, { useEffect, useState } from "react";

import useAppStore from "../../zustand/store";

/**
 * Old HUD UI (unchanged look) but reads from the store instead of props.
 * - showGun      ← s.showGun
 * - ammoInMag    ← s.ammoInMag || s.currentAmmo || s.ammo || s.gunAmmo || s.gameStats?.*
 * - ammoReserve  ← s.ammoReserve || s.reserveAmmo || s.gunReserve || s.gameStats?.*
 *
 * No logic changes — pure UI.
 */
export const HUD: React.FC = () => {
  // --- Weapon awareness for the ammo UI ---
  // Prefer a store field if you already keep activeWeapon there.
  const storeWeapon = useAppStore(
    (s: any) => s.activeWeapon ?? s.weapon ?? null
  );

  // Fallback path: listen for a broadcast from App (see step 2).
  const [hudWeapon, setHudWeapon] = useState<"pistol" | "shotgun">("pistol");

  useEffect(() => {
    const onWpn = (e: Event) => {
      const ce = e as CustomEvent<{ weapon: "pistol" | "shotgun" }>;
      if (ce?.detail?.weapon) setHudWeapon(ce.detail.weapon);
    };
    window.addEventListener("hud:weapon", onWpn as EventListener);
    return () =>
      window.removeEventListener("hud:weapon", onWpn as EventListener);
  }, []);

  // Final weapon value used by HUD (store wins if present)
  const weapon: "pistol" | "shotgun" = (storeWeapon as any) ?? hudWeapon;

  // Pull values from the store with resilient fallbacks (names differ between builds)
  const showGun = useAppStore((s: any) => !!s.showGun);

  const ammoInMag = useAppStore(
    (s: any) =>
      (s.ammoInMag ??
        s.currentAmmo ??
        s.ammo ??
        s.gunAmmo ??
        s.gameStats?.ammoInMag ??
        s.gameStats?.currentAmmo ??
        s.gameStats?.ammo ??
        0) | 0
  );

  const ammoReserve = useAppStore(
    (s: any) =>
      (s.ammoReserve ??
        s.reserveAmmo ??
        s.gunReserve ??
        s.gameStats?.ammoReserve ??
        s.gameStats?.reserveAmmo ??
        0) | 0
  );

  // Live ammo pushed from Gun.tsx (non-persistent)
  const [hudMag, setHudMag] = useState<number | null>(null);
  const [hudReserve, setHudReserve] = useState<number | null>(null);

  useEffect(() => {
    const onAmmo = (e: Event) => {
      const ce = e as CustomEvent<{ mag: number; reserve: number }>;
      if (!ce?.detail) return;
      setHudMag(ce.detail.mag);
      setHudReserve(ce.detail.reserve);
    };
    window.addEventListener("hud:ammo", onAmmo as EventListener);
    return () =>
      window.removeEventListener("hud:ammo", onAmmo as EventListener);
  }, []);

  const pad3 = (n: number) => String(Math.max(0, n | 0)).padStart(3, "0");

  // prefer live HUD numbers from Gun; fall back to store values
  const bigAmmo = pad3(showGun ? hudMag ?? ammoInMag : 0);
  const reserveAmmo = pad3(showGun ? hudReserve ?? ammoReserve : 0);

  return (
    <div
      style={{
        width: 260,
        top: 20,
        right: 20,
        height: 92,
        borderRadius: 4,
        overflow: "hidden",
        border: "1px solid #5c6770",
        boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
        fontFamily: "'Share Tech Mono', monospace",
        userSelect: "none",
        background: "linear-gradient(180deg, #AEB4BD 0%, #A7ACB5 100%)",
        position: "fixed",
        zIndex: 1200,
        pointerEvents: "none",
      }}
    >
      {/* Web font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap"
        rel="stylesheet"
      />

      {/* TOP STRIP */}
      <div
        style={{
          background: "#2a3944",
          height: 32,
          width: "100%",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      />

      {/* HEALTH BAR (visual only, kept from old HUD) */}
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 12,
          right: 12,
          height: 16,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {/* Plus icon */}
        <div
          style={{
            width: 18,
            height: 18,
            display: "grid",
            placeItems: "center",
          }}
        >
          <div style={{ position: "relative", width: 14, height: 14 }}>
            <div
              style={{
                position: "absolute",
                left: 6,
                top: 0,
                width: 2,
                height: 14,
                background: "#ffffff",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 6,
                width: 14,
                height: 2,
                background: "#ffffff",
              }}
            />
          </div>
        </div>

        {/* Track */}
        <div
          style={{
            flex: 1,
            height: 16,
            background: "#0d0d0d",
            borderRadius: 2,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Orange dots + gray gap */}
          <div
            style={{
              position: "absolute",
              left: 6,
              top: 3,
              display: "flex",
              alignItems: "center",
              gap: 2,
              zIndex: 2,
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  background: "#F47B00",
                }}
              />
            ))}
            <div
              style={{
                width: 6,
                height: 6,
                background: "#6f7b85",
              }}
            />
          </div>

          {/* Fill (kept as-is from old UI) */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: "68%",
              background: "#F47B00",
            }}
          />
        </div>
      </div>

      {/* LOWER STRIP */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 60,
          display: "grid",
          gridTemplateColumns: "56px 84px 1fr",
          alignItems: "center",
        }}
      >
        {/* Left tab: thumb until gun is equipped */}
        <div
          style={{
            height: "100%",
            background: "#303b45",
            borderRight: "1px solid #1e272f",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {showGun ? (
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 8,
                    height: 26,
                    background: "#ffffff",
                    borderRadius: 2,
                  }}
                />
              ))}
            </div>
          ) : (
            <img
              src="/thumb.png"
              alt="thumb"
              style={{
                width: 128,
                height: 64,
                objectFit: "contain",
                pointerEvents: "none",
                userSelect: "none",
              }}
              draggable={false}
            />
          )}
        </div>

        {/* Center tab: gun icon only after pickup */}

        <div
          style={{
            height: "100%",
            borderRight: "1px solid #5c6770",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingLeft: 4,
          }}
        >
          {showGun && (
            <img
              // NOTE: ibb.co links are often page URLs. If it doesn't render,
              // open it and copy the *direct* image URL (hosted on i.ibb.co with .png/.jpg),
              // or drop a file into /public/ui/shotgun.png and use "/ui/shotgun.png".
              src={
                weapon === "shotgun" ? "./shot.png" : "/pistol.png"
              }
              alt={weapon === "shotgun" ? "shotgun" : "pistol"}
              style={{
                width: 128,
                height: 64,
                objectFit: "contain",
                // Keep the pistol blacked-out like before; show the shotgun image as-is
                filter: weapon === "shotgun" ? undefined : "brightness(0)",
                pointerEvents: "none",
                userSelect: "none",
              }}
              draggable={false}
            />
          )}
        </div>

        {/* Ammo count */}
        <div
          style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            paddingLeft: 10,
            position: "relative",
          }}
        >
          <span
            style={{
              fontSize: 34,
              lineHeight: 1,
              color: "#0a0a0a",
              letterSpacing: 1,
              minWidth: 60,
              display: "inline-block",
              textAlign: "left",
            }}
          >
            {bigAmmo}
          </span>
          <span
            style={{
              position: "absolute",
              right: 10,
              bottom: 8,
              fontSize: 18,
              color: "#80868e",
            }}
          >
            {reserveAmmo}
          </span>
        </div>
      </div>
    </div>
  );
};

export default HUD;
