import { useDogStore } from "../store/dogStore";

export function ComfortBubble() {
  const comfortMessage = useDogStore((s) => s.comfortMessage);

  if (!comfortMessage) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: 170,
        backgroundColor: "rgba(255, 248, 220, 0.95)",
        color: "#5a3e1b",
        padding: "8px 12px",
        borderRadius: 10,
        border: "2px solid #d4a574",
        fontSize: 12,
        fontFamily: '"Courier New", monospace',
        maxWidth: 200,
        textAlign: "center",
        zIndex: 200,
        pointerEvents: "none",
        whiteSpace: "pre-wrap",
        lineHeight: 1.5,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      }}
    >
      {comfortMessage.comfort_text}
    </div>
  );
}
