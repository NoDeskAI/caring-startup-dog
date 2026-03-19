import { useDogStore } from "../store/dogStore";
import { DOG_STATES } from "../config/dog-states";

export function StatusBubble() {
  const showStatusBubble = useDogStore((s) => s.showStatusBubble);
  const dogState = useDogStore((s) => s.dogState);
  const statusData = useDogStore((s) => s.statusData);

  if (!showStatusBubble) return null;

  const stateConfig = DOG_STATES[dogState];
  const hoverText = statusData?.hover_text;

  return (
    <div
      className="pixel-box"
      style={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: 170,
        padding: "8px 10px",
        maxWidth: 200,
        textAlign: "center",
        zIndex: 100,
        pointerEvents: "none",
        whiteSpace: "pre-wrap",
        lineHeight: 1.6,
        fontSize: 11,
      }}
    >
      {hoverText ? (
        <div>{hoverText}</div>
      ) : (
        <div style={{ opacity: 0.75 }}>
          {stateConfig?.label || dogState}
        </div>
      )}
    </div>
  );
}
