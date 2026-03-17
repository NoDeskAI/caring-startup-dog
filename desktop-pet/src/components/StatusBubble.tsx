import { useDogStore } from "../store/dogStore";
import { DOG_STATES } from "../config/dog-states";

function energyColor(energy: number): string {
  if (energy >= 70) return "#4caf50";
  if (energy >= 30) return "#ff9800";
  return "#f44336";
}

export function StatusBubble() {
  const showStatusBubble = useDogStore((s) => s.showStatusBubble);
  const statusData = useDogStore((s) => s.statusData);
  const dogState = useDogStore((s) => s.dogState);
  const energy = useDogStore((s) => s.energy);

  if (!showStatusBubble) return null;

  const stateConfig = DOG_STATES[dogState];
  const barColor = energyColor(energy);

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: 170,
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        color: "#fff",
        padding: "10px 14px",
        borderRadius: 12,
        fontSize: 12,
        fontFamily: '"Courier New", monospace',
        maxWidth: 220,
        textAlign: "center",
        zIndex: 100,
        pointerEvents: "none",
        whiteSpace: "pre-wrap",
        lineHeight: 1.4,
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: 4 }}>
        {stateConfig?.label || dogState}
      </div>

      <div style={{ marginBottom: 4 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            fontSize: 11,
          }}
        >
          <span style={{ opacity: 0.7 }}>能量</span>
          <div
            style={{
              width: 80,
              height: 8,
              backgroundColor: "rgba(255,255,255,0.15)",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${energy}%`,
                height: "100%",
                backgroundColor: barColor,
                borderRadius: 4,
                transition: "width 0.5s ease, background-color 0.5s ease",
              }}
            />
          </div>
          <span style={{ fontWeight: "bold", color: barColor, minWidth: 36 }}>
            {energy}/100
          </span>
        </div>
      </div>

      {statusData?.work_summary && (
        <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 2 }}>
          {statusData.work_summary}
        </div>
      )}
      {statusData && (
        <div style={{ fontSize: 10, opacity: 0.55 }}>
          活跃 {statusData.active_hours?.toFixed(1) ?? "—"}h | 消息{" "}
          {statusData.msg_count_1h ?? 0}
        </div>
      )}
    </div>
  );
}
