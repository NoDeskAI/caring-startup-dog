import { useDogStore } from "../store/dogStore";
import { DOG_STATES } from "../config/dog-states";

export function StatusBubble() {
  const showStatusBubble = useDogStore((s) => s.showStatusBubble);
  const statusData = useDogStore((s) => s.statusData);
  const dogState = useDogStore((s) => s.dogState);

  if (!showStatusBubble) return null;

  const stateConfig = DOG_STATES[dogState];

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: 170,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        color: "#fff",
        padding: "8px 12px",
        borderRadius: 10,
        fontSize: 12,
        fontFamily: '"Courier New", monospace',
        maxWidth: 200,
        textAlign: "center",
        zIndex: 100,
        pointerEvents: "none",
        whiteSpace: "pre-wrap",
        lineHeight: 1.4,
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: 2 }}>
        {stateConfig?.label || dogState}
      </div>
      {statusData && (
        <div style={{ fontSize: 11, opacity: 0.85 }}>
          {statusData.work_summary || statusData.message}
        </div>
      )}
      {statusData && (
        <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>
          活跃 {statusData.active_hours.toFixed(1)}h | 消息{" "}
          {statusData.msg_count_1h}
        </div>
      )}
    </div>
  );
}
