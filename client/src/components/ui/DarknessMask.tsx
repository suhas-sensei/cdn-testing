// components/ui/DarknessMask.tsx
import React, { useEffect, useRef } from "react";

type Props = {
  darkness?: number;   // fallback alpha when no proximity info yet
  radiusPct?: number;  // optional center bright spot (set 0 to disable)
  feather?: number;    // softness of the center spot
};

const clamp = (v:number,a:number,b:number) => Math.min(b, Math.max(a, v));

export default function DarknessMask({
  darkness = 0.96,
  radiusPct = 0,      // <- disable center spot by default
  feather = 220,
}: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cvs = ref.current!;
    const ctx = cvs.getContext("2d")!;
    let cssW = 0, cssH = 0, dpr = 1, raf = 0;

    const resize = () => {
      dpr = clamp(window.devicePixelRatio || 1, 1, 2);
      cssW = Math.floor(window.innerWidth);
      cssH = Math.floor(window.innerHeight);
      cvs.width = Math.floor(cssW * dpr);
      cvs.height = Math.floor(cssH * dpr);
      cvs.style.width = `${cssW}px`;
      cvs.style.height = `${cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // drawing in CSS px now
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      raf = requestAnimationFrame(draw);

      const a = clamp((window as any).__DARK_ALPHA ?? darkness, 0, 1);

      // full-screen darkness
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.fillStyle = `rgba(0,0,0,${a})`;
      ctx.fillRect(0, 0, cssW, cssH);

      // optional central bright spot (legacy look)
      if (radiusPct > 0) {
        const minSide = Math.min(cssW, cssH);
        const baseR = minSide * clamp(radiusPct, 0, 1);
        const soft = feather;
        const grad = ctx.createRadialGradient(
          cssW / 2, cssH / 2, Math.max(1, baseR * 0.6),
          cssW / 2, cssH / 2, baseR + soft
        );
        ctx.globalCompositeOperation = "destination-out";
        grad.addColorStop(0.0, "rgba(0,0,0,1)");
        grad.addColorStop(baseR / (baseR + soft), "rgba(0,0,0,1)");
        grad.addColorStop(1.0, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cssW / 2, cssH / 2, baseR + soft, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [darkness, feather, radiusPct]);

  return (
    <canvas
      ref={ref}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 2000,
      }}
    />
  );
}
