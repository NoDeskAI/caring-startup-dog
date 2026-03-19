import { useEffect, useRef } from "react";
import { useDogStore } from "../store/dogStore";

const AUTO_DISMISS_MS = 12_000;

export function ComfortBubble() {
  const comfortMessage = useDogStore((s) => s.comfortMessage);
  const setComfortMessage = useDogStore((s) => s.setComfortMessage);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!comfortMessage) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setComfortMessage(null);
    }, AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [comfortMessage, setComfortMessage]);

  if (!comfortMessage) return null;

  return (
    <div
      onClick={() => setComfortMessage(null)}
      style={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: 180,
        zIndex: 200,
        cursor: "pointer",
        maxWidth: 200,
      }}
    >
      {/* speech bubble body */}
      <div
        className="pixel-box"
        style={{
          padding: "8px 12px",
          fontSize: 11,
          lineHeight: 1.6,
          textAlign: "center",
          whiteSpace: "pre-wrap",
          position: "relative",
        }}
      >
        {comfortMessage.comfort_text}
      </div>

      {/* pixel triangle pointing down */}
      <div
        style={{
          width: 0,
          height: 0,
          margin: "0 auto",
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          borderTop: "8px solid var(--pixel-border)",
          position: "relative",
          top: -1,
        }}
      />
    </div>
  );
}
