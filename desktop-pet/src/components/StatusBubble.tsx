import { useDogStore } from "../store/dogStore";
import { DOG_STATES } from "../config/dog-states";

function energyBarChar(energy: number, i: number): string {
  const filled = Math.round(energy / 10);
  return i < filled ? "|" : ".";
}

function energyColor(energy: number): string {
  if (energy >= 70) return "#4a8";
  if (energy >= 30) return "#c84";
  return "#c44";
}

export function StatusBubble() {
  const showStatusBubble = useDogStore((s) => s.showStatusBubble);
  const statusData = useDogStore((s) => s.statusData);
  const dogState = useDogStore((s) => s.dogState);
  const energy = useDogStore((s) => s.energy);

  if (!showStatusBubble) return null;

  const stateConfig = DOG_STATES[dogState];
  const barColor = energyColor(energy);
  const bar = Array.from({ length: 10 }, (_, i) => energyBarChar(energy, i)).join("");

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
      <div style={{ fontWeight: "bold", marginBottom: 2 }}>
        {stateConfig?.label || dogState}
      </div>

      <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: 1 }}>
        <span style={{ opacity: 0.7 }}>HP </span>
        <span style={{ color: barColor }}>[{bar}]</span>
        <span style={{ color: barColor, fontWeight: "bold" }}>
          {" "}
          {energy}
        </span>
      </div>

      {statusData?.work_summary && (
        <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>
          {statusData.work_summary}
        </div>
      )}
      {statusData && (
        <div style={{ fontSize: 9, opacity: 0.5, marginTop: 1 }}>
          活跃{statusData.active_hours?.toFixed(1) ?? "--"}h / 消息
          {statusData.msg_count_1h ?? 0}
        </div>
      )}
    </div>
  );
}
