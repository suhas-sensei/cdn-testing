import React, { useEffect, useRef } from "react";

type Props = {
  onEnded: () => void;
  onError?: (err?: unknown) => void;
};

export function TutorialVideo({ onEnded, onError }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const tryPlay = async () => {
      try {
        await v.play();
      } catch {
        // ignore; user already clicked the "Enter Game" button so this should work
      }
    };
    const t = setTimeout(tryPlay, 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "black",
        zIndex: 9999,
        display: "grid",
        placeItems: "center",
      }}
    >
      <video
        ref={ref}
        src="/tutorial.mp4"
        autoPlay
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        onEnded={onEnded}
        onError={() => onError?.()}
      />
    </div>
  );
}
