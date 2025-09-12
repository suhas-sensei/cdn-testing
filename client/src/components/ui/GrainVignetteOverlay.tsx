import React, { useEffect, useRef } from "react";

type Props = {
  /** 0–1: how strong the grain looks */
  intensity?: number;
  /** frames per second for grain animation (lower = grittier & cheaper) */
  fps?: number;
  /** subtle dark tint over the scene */
  tint?: string;
  /** 0–1: how strong the vignette is (closer to 1 = stronger) */
  vignette?: number;
  /** stacking order below your HUD (your HUD uses 3000/5000) */
  zIndex?: number;
};

export default function GrainVignetteOverlay({
  intensity = 0.12,
  fps = 24,
  tint = "rgba(18, 14, 14, 0.22)",
  vignette = 0.65,
  zIndex = 1500,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const noiseRef = useRef<HTMLCanvasElement>(document.createElement("canvas"));
  const raf = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const noiseCanvas = noiseRef.current;
    const nctx = noiseCanvas.getContext("2d")!;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // small tile we update every frame and repeat across the screen
    noiseCanvas.width = 128;
    noiseCanvas.height = 128;

    const drawNoiseTile = () => {
      const id = nctx.createImageData(noiseCanvas.width, noiseCanvas.height);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random() * 255;
        d[i] = d[i + 1] = d[i + 2] = v; // monochrome
        d[i + 3] = 255;
      }
      nctx.putImageData(id, 0, 0);
    };

    let last = 0;
    const step = 1000 / Math.max(1, fps);

    const loop = (t: number) => {
      if (t - last >= step) {
        last = t;
        drawNoiseTile();
        const pattern = ctx.createPattern(noiseCanvas, "repeat")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = intensity;
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", resize);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [fps, intensity]);

  // three layers: tint (dark mood), grain, vignette edges
  return (
    <>
      {/* subtle tint for a darker, moodier base */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: tint,
          pointerEvents: "none",
          zIndex: zIndex - 1,
        }}
      />
      {/* animated film grain */}
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          pointerEvents: "none",
          zIndex,
          // multiply keeps highlights, deepens shadows = gritty
          mixBlendMode: "multiply",
        }}
      />
      {/* vignette */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: zIndex + 1,
          background: `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) ${Math.round(
            (1 - vignette) * 100
          )}%, rgba(0,0,0,0.7) 100%)`,
        }}
      />
    </>
  );
}