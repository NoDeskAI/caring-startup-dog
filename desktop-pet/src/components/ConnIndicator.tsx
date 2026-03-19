import { useDogStore } from "../store/dogStore";
import type { ConnStatus } from "../store/dogStore";

const DOT_COLORS: Record<ConnStatus, string> = {
  ok: "#4ade80",
  stale: "#facc15",
  off: "#f87171",
};

const LABELS: Record<ConnStatus, string> = {
  ok: "OK",
  stale: "...",
  off: "OFF",
};

function Dot({ status, label }: { status: ConnStatus; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: 9,
        color: "var(--pixel-text-light)",
        opacity: 0.85,
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 6,
          height: 6,
          borderRadius: 1,
          background: DOT_COLORS[status],
          boxShadow: status === "ok" ? `0 0 4px ${DOT_COLORS[status]}` : "none",
        }}
      />
      {label}
      <span style={{ fontSize: 8, opacity: 0.7 }}>{LABELS[status]}</span>
    </span>
  );
}

export function ConnIndicator() {
  const { openclaw, feishu } = useDogStore((s) => s.connState);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 4,
        left: 6,
        display: "flex",
        gap: 8,
        fontFamily: "var(--pixel-font)",
        pointerEvents: "none",
        zIndex: 5,
        userSelect: "none",
      }}
    >
      <Dot status={openclaw} label="OC" />
      <Dot status={feishu} label="FS" />
    </div>
  );
}
