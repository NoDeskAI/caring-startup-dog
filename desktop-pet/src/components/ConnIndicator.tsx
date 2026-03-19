import { useDogStore } from "../store/dogStore";
import type { ConnStatus } from "../store/dogStore";

const DOT_COLORS: Record<ConnStatus, string> = {
  ok: "#4ade80",
  stale: "#facc15",
  off: "#f87171",
};

export function ConnIndicator() {
  const { openclaw, feishu } = useDogStore((s) => s.connState);
  const isHovering = useDogStore((s) => s.isHovering);

  if (!isHovering) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 355,
        left: 95,
        display: "flex",
        flexDirection: "column",
        gap: 3,
        pointerEvents: "none",
        zIndex: 5,
        userSelect: "none",
      }}
    >
      <span
        style={{
          display: "block",
          width: 4,
          height: 4,
          borderRadius: 1,
          background: DOT_COLORS[openclaw],
          boxShadow: openclaw === "ok" ? `0 0 3px ${DOT_COLORS[openclaw]}` : "none",
        }}
      />
      <span
        style={{
          display: "block",
          width: 4,
          height: 4,
          borderRadius: 1,
          background: DOT_COLORS[feishu],
          boxShadow: feishu === "ok" ? `0 0 3px ${DOT_COLORS[feishu]}` : "none",
        }}
      />
    </div>
  );
}
